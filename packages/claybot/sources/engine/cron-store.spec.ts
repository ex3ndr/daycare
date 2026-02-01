import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import { CronStore, parseFrontmatter, serializeFrontmatter } from "./cron-store.js";

describe("parseFrontmatter", () => {
  it("parses basic frontmatter", () => {
    const content = `---
name: Daily Report
schedule: 0 9 * * *
enabled: true
---

Generate a daily report.`;

    const result = parseFrontmatter(content);

    expect(result.frontmatter).toEqual({
      name: "Daily Report",
      schedule: "0 9 * * *",
      enabled: true
    });
    expect(result.body).toBe("Generate a daily report.");
  });

  it("handles content without frontmatter", () => {
    const content = "Just some text";

    const result = parseFrontmatter(content);

    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe("Just some text");
  });

  it("handles quoted values", () => {
    const content = `---
name: "Task: Important"
---

Body`;

    const result = parseFrontmatter(content);

    expect(result.frontmatter.name).toBe("Task: Important");
  });

  it("parses numeric values", () => {
    const content = `---
count: 42
---

Body`;

    const result = parseFrontmatter(content);

    expect(result.frontmatter.count).toBe(42);
  });
});

describe("serializeFrontmatter", () => {
  it("serializes frontmatter and body", () => {
    const frontmatter = {
      name: "Test Task",
      schedule: "* * * * *",
      enabled: true
    };
    const body = "Do something.";

    const result = serializeFrontmatter(frontmatter, body);

    expect(result).toContain("---");
    expect(result).toContain("name: Test Task");
    expect(result).toContain("schedule: * * * * *");
    expect(result).toContain("enabled: true");
    expect(result).toContain("Do something.");
  });

  it("quotes strings with colons", () => {
    const frontmatter = { name: "Task: Important" };
    const result = serializeFrontmatter(frontmatter, "");

    expect(result).toContain('name: "Task: Important"');
  });
});

describe("CronStore", () => {
  let tempDir: string;
  let store: CronStore;
  const cuidPattern = /^[a-z0-9]{24,32}$/;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cron-store-test-"));
    store = new CronStore(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("creates and loads a task", async () => {
    const created = await store.createTask("daily-report", {
      name: "Daily Report",
      description: "Send the daily status report.",
      schedule: "0 9 * * *",
      prompt: "Generate a daily status report.",
      deleteAfterRun: true
    });

    expect(created.id).toBe("daily-report");
    expect(created.taskUid).toMatch(cuidPattern);
    expect(created.name).toBe("Daily Report");
    expect(created.description).toBe("Send the daily status report.");
    expect(created.schedule).toBe("0 9 * * *");
    expect(created.enabled).toBe(true);
    expect(created.deleteAfterRun).toBe(true);

    const loaded = await store.loadTask("daily-report");
    expect(loaded).not.toBeNull();
    expect(loaded!.taskUid).toBe(created.taskUid);
    expect(loaded!.name).toBe("Daily Report");
    expect(loaded!.description).toBe("Send the daily status report.");
    expect(loaded!.prompt).toBe("Generate a daily status report.");
    expect(loaded!.deleteAfterRun).toBe(true);
  });

  it("lists all tasks", async () => {
    await store.createTask("task-1", {
      name: "Task 1",
      schedule: "* * * * *",
      prompt: "Prompt 1"
    });
    await store.createTask("task-2", {
      name: "Task 2",
      schedule: "0 * * * *",
      prompt: "Prompt 2"
    });

    const tasks = await store.listTasks();

    expect(tasks.length).toBe(2);
    expect(tasks.map((t) => t.id).sort()).toEqual(["task-1", "task-2"]);
  });

  it("updates a task", async () => {
    await store.createTask("test-task", {
      name: "Original",
      description: "Original description",
      schedule: "* * * * *",
      prompt: "Original prompt"
    });

    const updated = await store.updateTask("test-task", {
      name: "Updated",
      description: "Updated description",
      prompt: "Updated prompt",
      deleteAfterRun: true
    });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("Updated");
    expect(updated!.description).toBe("Updated description");
    expect(updated!.prompt).toBe("Updated prompt");
    expect(updated!.schedule).toBe("* * * * *");
    expect(updated!.deleteAfterRun).toBe(true);
    expect(updated!.taskUid).toMatch(cuidPattern);
  });

  it("deletes a task", async () => {
    await store.createTask("to-delete", {
      name: "Delete Me",
      schedule: "* * * * *",
      prompt: "Prompt"
    });

    const deleted = await store.deleteTask("to-delete");
    expect(deleted).toBe(true);

    const loaded = await store.loadTask("to-delete");
    expect(loaded).toBeNull();
  });

  it("reads and writes memory", async () => {
    await store.createTask("memory-test", {
      name: "Memory Test",
      schedule: "* * * * *",
      prompt: "Prompt"
    });

    const initialMemory = await store.readMemory("memory-test");
    expect(initialMemory).toBe("No memory\n");

    await store.writeMemory("memory-test", "Task completed 3 times.");

    const updatedMemory = await store.readMemory("memory-test");
    expect(updatedMemory).toBe("Task completed 3 times.");
  });

  it("creates files directory", async () => {
    const task = await store.createTask("files-test", {
      name: "Files Test",
      schedule: "* * * * *",
      prompt: "Prompt"
    });

    const stat = await fs.stat(task.filesPath);
    expect(stat.isDirectory()).toBe(true);
  });

  it("returns null for non-existent task", async () => {
    const task = await store.loadTask("does-not-exist");
    expect(task).toBeNull();
  });

  it("ignores tasks without a valid taskId", async () => {
    const taskDir = path.join(tempDir, "invalid-task");
    await fs.mkdir(taskDir, { recursive: true });
    const taskPath = path.join(taskDir, "TASK.md");
    const content = `---
name: Invalid Task
schedule: "* * * * *"
---

Do something.`;
    await fs.writeFile(taskPath, content, "utf8");

    const loaded = await store.loadTask("invalid-task");
    expect(loaded).toBeNull();

    const badIdDir = path.join(tempDir, "bad-id-task");
    await fs.mkdir(badIdDir, { recursive: true });
    const badIdPath = path.join(badIdDir, "TASK.md");
    const badIdContent = `---
taskId: not-a-cuid
name: Bad Task
schedule: "* * * * *"
---

Do something else.`;
    await fs.writeFile(badIdPath, badIdContent, "utf8");

    const badIdLoaded = await store.loadTask("bad-id-task");
    expect(badIdLoaded).toBeNull();

    const tasks = await store.listTasks();
    expect(tasks.find((task) => task.id === "invalid-task")).toBeUndefined();
    expect(tasks.find((task) => task.id === "bad-id-task")).toBeUndefined();
  });

  it("generates a slug id from name", async () => {
    const id = await store.generateTaskIdFromName("Create Image in Morning");
    expect(id).toBe("create-image-in-morning");
  });
});
