package main

import (
    "bufio"
    "errors"
    "fmt"
    "os"
    "os/exec"
    "os/signal"
    "strconv"
    "strings"
    "sync"
    "syscall"
)

type parsedArgs struct {
    controlPath string
    command     []string
}

type execSupervisor struct {
    childPID int
    fifo     *os.File
    done     chan struct{}
    once     sync.Once
    mu       sync.Mutex
}

var signalByName = map[string]syscall.Signal{
    "SIGTERM": syscall.SIGTERM,
    "SIGINT":  syscall.SIGINT,
    "SIGHUP":  syscall.SIGHUP,
    "SIGKILL": syscall.SIGKILL,
}

func main() {
    args, err := argsParse(os.Args[1:])
    if err != nil {
        fmt.Fprintf(os.Stderr, "daycare-exec-supervisor: %s\n", err.Error())
        os.Exit(1)
    }

    if err := fifoReset(args.controlPath); err != nil {
        fmt.Fprintf(os.Stderr, "daycare-exec-supervisor: %s\n", err.Error())
        os.Exit(1)
    }
    defer os.Remove(args.controlPath)

    fifo, err := os.OpenFile(args.controlPath, os.O_RDWR, os.ModeNamedPipe)
    if err != nil {
        fmt.Fprintf(os.Stderr, "daycare-exec-supervisor: open fifo: %s\n", err.Error())
        os.Exit(1)
    }

    cmd := exec.Command(args.command[0], args.command[1:]...)
    cmd.Stdin = os.Stdin
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr
    cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}

    if err := cmd.Start(); err != nil {
        _ = fifo.Close()
        fmt.Fprintf(os.Stderr, "daycare-exec-supervisor: start child: %s\n", err.Error())
        os.Exit(1)
    }

    supervisor := &execSupervisor{
        childPID: cmd.Process.Pid,
        fifo:     fifo,
        done:     make(chan struct{}),
    }
    go supervisor.controlLoop()
    go supervisor.signalLoop()

    waitError := cmd.Wait()
    supervisor.close()

    os.Exit(exitStatus(waitError))
}

func argsParse(argv []string) (parsedArgs, error) {
    controlPath := ""
    command := []string{}

    for index := 0; index < len(argv); index += 1 {
        value := argv[index]
        switch value {
            case "--control":
                if index+1 >= len(argv) {
                    return parsedArgs{}, errors.New("expected --control <path>")
                }
                controlPath = argv[index+1]
                index += 1
            case "--":
                command = append(command, argv[index+1:]...)
                index = len(argv)
            default:
                return parsedArgs{}, fmt.Errorf("unexpected argument: %s", value)
        }
    }

    if controlPath == "" {
        return parsedArgs{}, errors.New("expected --control <path>")
    }
    if len(command) == 0 {
        return parsedArgs{}, errors.New("expected command after --")
    }

    return parsedArgs{
        controlPath: controlPath,
        command:     command,
    }, nil
}

func fifoReset(controlPath string) error {
    if err := os.Remove(controlPath); err != nil && !errors.Is(err, os.ErrNotExist) {
        return fmt.Errorf("remove fifo: %w", err)
    }
    if err := syscall.Mkfifo(controlPath, 0o600); err != nil {
        return fmt.Errorf("create fifo: %w", err)
    }
    return nil
}

func (supervisor *execSupervisor) controlLoop() {
    scanner := bufio.NewScanner(supervisor.fifo)
    for scanner.Scan() {
        name := strings.TrimSpace(scanner.Text())
        signalValue, ok := signalByName[name]
        if !ok {
            continue
        }
        supervisor.killTree(signalValue)
    }
}

func (supervisor *execSupervisor) signalLoop() {
    signals := make(chan os.Signal, 1)
    signal.Notify(signals, syscall.SIGTERM, syscall.SIGINT, syscall.SIGHUP)
    defer signal.Stop(signals)

    for {
        select {
            case received := <-signals:
                signalValue, ok := received.(syscall.Signal)
                if ok {
                    supervisor.killTree(signalValue)
                }
            case <-supervisor.done:
                return
        }
    }
}

func (supervisor *execSupervisor) close() {
    supervisor.once.Do(func() {
        close(supervisor.done)
        _ = supervisor.fifo.Close()
    })
}

func (supervisor *execSupervisor) killTree(signalValue syscall.Signal) {
    supervisor.mu.Lock()
    defer supervisor.mu.Unlock()
    processTreeKill(supervisor.childPID, signalValue)
}

func processTreeKill(pid int, signalValue syscall.Signal) {
    if pid <= 0 {
        return
    }

    for _, childPID := range processChildrenRead(pid) {
        processTreeKill(childPID, signalValue)
    }

    killIgnoreMissing(-pid, signalValue)
    killIgnoreMissing(pid, signalValue)
}

func processChildrenRead(pid int) []int {
    data, err := os.ReadFile(fmt.Sprintf("/proc/%d/task/%d/children", pid, pid))
    if err != nil {
        return []int{}
    }

    values := strings.Fields(string(data))
    children := make([]int, 0, len(values))
    for _, value := range values {
        childPID, err := strconv.Atoi(value)
        if err != nil || childPID <= 0 {
            continue
        }
        children = append(children, childPID)
    }
    return children
}

func killIgnoreMissing(pid int, signalValue syscall.Signal) {
    err := syscall.Kill(pid, signalValue)
    if err == nil {
        return
    }

    if errors.Is(err, syscall.ESRCH) || errors.Is(err, syscall.EPERM) {
        return
    }
}

func exitStatus(err error) int {
    if err == nil {
        return 0
    }

    exitError := &exec.ExitError{}
    if errors.As(err, &exitError) {
        status, ok := exitError.Sys().(syscall.WaitStatus)
        if ok {
            if status.Exited() {
                return status.ExitStatus()
            }
            if status.Signaled() {
                return 128 + int(status.Signal())
            }
        }
    }

    return 1
}
