import { describe, expect, it, vi } from "vitest";

import { downloadTextFile } from "./downloadTextFile";

describe("downloadTextFile", () => {
    it("revokes the object url asynchronously after click", () => {
        const click = vi.fn();
        const remove = vi.fn();
        const scheduleCallbacks: Array<() => void> = [];
        const revokeObjectURL = vi.fn();
        const anchor = {
            href: "",
            download: "",
            click,
            remove
        };
        const appendAnchor = vi.fn();

        downloadTextFile("history.jsonl", "{}", "application/x-ndjson;charset=utf-8", {
            createObjectURL: vi.fn(() => "blob:history"),
            revokeObjectURL,
            createAnchor: () => anchor,
            appendAnchor,
            schedule: (callback) => {
                scheduleCallbacks.push(callback);
            }
        });

        expect(anchor.href).toBe("blob:history");
        expect(anchor.download).toBe("history.jsonl");
        expect(appendAnchor).toHaveBeenCalledOnce();
        expect(click).toHaveBeenCalledOnce();
        expect(remove).toHaveBeenCalledOnce();
        expect(revokeObjectURL).not.toHaveBeenCalled();
        expect(scheduleCallbacks).toHaveLength(1);

        scheduleCallbacks[0]();
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:history");
    });
});
