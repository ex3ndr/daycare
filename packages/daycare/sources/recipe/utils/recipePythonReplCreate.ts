import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { createInterface } from "node:readline";

import { recipePythonSandboxPathResolve } from "./recipePythonSandboxPathResolve.js";

export type RecipePythonExecutionResult = {
    ok: boolean;
    stdout: string;
    stderr: string;
    result: string | null;
    error: string | null;
};

export type RecipePythonRepl = {
    sandboxDir: string;
    execute: (code: string) => Promise<RecipePythonExecutionResult>;
    close: () => Promise<void>;
};

type PendingRequest = {
    resolve: (value: RecipePythonExecutionResult) => void;
    reject: (error: Error) => void;
};

type PythonWireResponse = {
    id?: string;
    ok?: boolean;
    stdout?: string;
    stderr?: string;
    result?: string | null;
    error?: string | null;
};

const PYTHON_SERVER_SCRIPT = `
import builtins
import contextlib
import io
import json
import os
import pathlib
import traceback

ROOT = os.path.realpath(os.getcwd())

def _resolve(path):
    if isinstance(path, os.PathLike):
        path = os.fspath(path)
    if not isinstance(path, str):
        raise TypeError("path must be str or PathLike")
    if os.path.isabs(path):
        return os.path.realpath(path)
    return os.path.realpath(os.path.join(ROOT, path))

def _assert_write_allowed(path):
    resolved = _resolve(path)
    if resolved == ROOT or resolved.startswith(ROOT + os.sep):
        return
    raise PermissionError(f"Write denied outside sandbox: {path}")

def _mode_writes(mode):
    return any(flag in mode for flag in ("w", "a", "x", "+"))

_open = builtins.open
def _guarded_open(file, mode="r", *args, **kwargs):
    if _mode_writes(mode):
        _assert_write_allowed(file)
    return _open(file, mode, *args, **kwargs)
builtins.open = _guarded_open

_os_open = os.open
def _guarded_os_open(path, flags, *args, **kwargs):
    write_flags = (
        getattr(os, "O_WRONLY", 0),
        getattr(os, "O_RDWR", 0),
        getattr(os, "O_CREAT", 0),
        getattr(os, "O_TRUNC", 0),
        getattr(os, "O_APPEND", 0),
    )
    if any((flags & flag) != 0 for flag in write_flags if flag):
        _assert_write_allowed(path)
    return _os_open(path, flags, *args, **kwargs)
os.open = _guarded_os_open

def _guard_single(fn):
    original = getattr(os, fn)
    def wrapped(path, *args, **kwargs):
        _assert_write_allowed(path)
        return original(path, *args, **kwargs)
    setattr(os, fn, wrapped)

for _name in ("remove", "unlink", "mkdir", "makedirs", "rmdir"):
    if hasattr(os, _name):
        _guard_single(_name)

_rename = os.rename
def _guarded_rename(src, dst, *args, **kwargs):
    _assert_write_allowed(src)
    _assert_write_allowed(dst)
    return _rename(src, dst, *args, **kwargs)
os.rename = _guarded_rename

if hasattr(os, "replace"):
    _replace = os.replace
    def _guarded_replace(src, dst, *args, **kwargs):
        _assert_write_allowed(src)
        _assert_write_allowed(dst)
        return _replace(src, dst, *args, **kwargs)
    os.replace = _guarded_replace

_chdir = os.chdir
def _guarded_chdir(target):
    resolved = _resolve(target)
    if not (resolved == ROOT or resolved.startswith(ROOT + os.sep)):
        raise PermissionError(f"chdir denied outside sandbox: {target}")
    return _chdir(target)
os.chdir = _guarded_chdir

globals_dict = {"__name__": "__main__"}

def _execute(code):
    stdout = io.StringIO()
    stderr = io.StringIO()
    result = None
    error = None
    ok = True

    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        try:
            try:
                compiled = compile(code, "<recipe-python>", "eval")
            except SyntaxError:
                compiled = compile(code, "<recipe-python>", "exec")
                exec(compiled, globals_dict, globals_dict)
            else:
                value = eval(compiled, globals_dict, globals_dict)
                result = repr(value)
        except Exception:
            ok = False
            error = traceback.format_exc()

    return {
        "ok": ok,
        "stdout": stdout.getvalue(),
        "stderr": stderr.getvalue(),
        "result": result,
        "error": error,
    }

while True:
    line = input()
    request = json.loads(line)
    request_id = request.get("id")
    code = request.get("code")

    if not isinstance(code, str):
        response = {
            "id": request_id,
            "ok": False,
            "stdout": "",
            "stderr": "",
            "result": None,
            "error": "Invalid request: code must be string",
        }
    else:
        payload = _execute(code)
        response = {"id": request_id, **payload}

    print(json.dumps(response), flush=True)
`;

/**
 * Creates a persistent system-python REPL process for recipe execution.
 * Expects: python3 is available and writes stay within sources/recipe/.sandbox/<name>.
 */
export async function recipePythonReplCreate(name: string): Promise<RecipePythonRepl> {
    const sandboxDir = recipePythonSandboxPathResolve(name);
    await fs.mkdir(sandboxDir, { recursive: true });

    const pythonBin = process.env.DAYCARE_RECIPE_PYTHON_BIN?.trim() || "python3";
    const processRef = spawn(pythonBin, ["-u", "-c", PYTHON_SERVER_SCRIPT], {
        cwd: sandboxDir,
        stdio: ["pipe", "pipe", "pipe"]
    });

    const pending = new Map<string, PendingRequest>();
    const stderrChunks: string[] = [];
    let processError: Error | null = null;
    const stdoutInterface = createInterface({ input: processRef.stdout });
    const stderrInterface = createInterface({ input: processRef.stderr });

    stderrInterface.on("line", (line) => {
        stderrChunks.push(line);
    });

    stdoutInterface.on("line", (line) => {
        let payload: PythonWireResponse;
        try {
            payload = JSON.parse(line) as PythonWireResponse;
        } catch {
            return;
        }

        const id = typeof payload.id === "string" ? payload.id : null;
        if (!id) {
            return;
        }
        const request = pending.get(id);
        if (!request) {
            return;
        }
        pending.delete(id);

        request.resolve({
            ok: payload.ok === true,
            stdout: typeof payload.stdout === "string" ? payload.stdout : "",
            stderr: typeof payload.stderr === "string" ? payload.stderr : "",
            result: typeof payload.result === "string" ? payload.result : null,
            error: typeof payload.error === "string" ? payload.error : null
        });
    });

    processRef.on("error", (error) => {
        processError = error;
        for (const request of pending.values()) {
            request.reject(error);
        }
        pending.clear();
    });

    processRef.on("exit", (code, signal) => {
        const reason = `Python REPL exited code=${code ?? "null"} signal=${signal ?? "null"}`;
        const stderr = stderrChunks.join("\n").trim();
        const suffix = stderr ? ` stderr=${stderr}` : "";
        for (const request of pending.values()) {
            request.reject(new Error(`${reason}${suffix}`));
        }
        pending.clear();
    });

    let counter = 0;
    const execute = (code: string): Promise<RecipePythonExecutionResult> => {
        if (processError) {
            return Promise.reject(processError);
        }
        if (processRef.killed || processRef.exitCode !== null) {
            return Promise.reject(new Error("Python REPL is not running."));
        }

        const id = `${Date.now()}-${counter++}`;
        return new Promise<RecipePythonExecutionResult>((resolve, reject) => {
            const timeout = setTimeout(() => {
                pending.delete(id);
                reject(new Error("Python REPL execution timed out."));
            }, 20_000);

            pending.set(id, {
                resolve: (value) => {
                    clearTimeout(timeout);
                    resolve(value);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                }
            });
            processRef.stdin.write(`${JSON.stringify({ id, code })}\n`, (error) => {
                if (!error) {
                    return;
                }
                pending.delete(id);
                clearTimeout(timeout);
                reject(error);
            });
        });
    };

    const close = async (): Promise<void> => {
        stdoutInterface.close();
        stderrInterface.close();

        if (processRef.exitCode !== null || processRef.killed) {
            return;
        }

        await new Promise<void>((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve();
            };

            const timer = setTimeout(() => {
                processRef.kill("SIGKILL");
                finish();
            }, 1000);

            processRef.once("exit", () => {
                clearTimeout(timer);
                finish();
            });
            processRef.kill("SIGTERM");
        });
    };

    await execute("None");
    return { sandboxDir, execute, close };
}
