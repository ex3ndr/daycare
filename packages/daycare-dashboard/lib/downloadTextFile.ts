type DownloadAnchor = {
    href: string;
    download: string;
    click: () => void;
    remove: () => void;
};

type DownloadTextFilePlatform = {
    createObjectURL: (blob: Blob) => string;
    revokeObjectURL: (href: string) => void;
    createAnchor: () => DownloadAnchor;
    appendAnchor: (anchor: DownloadAnchor) => void;
    schedule: (callback: () => void) => void;
};

/**
 * Downloads a text payload as a file in the browser.
 * Expects to run in a DOM-capable environment.
 */
export function downloadTextFile(
    fileName: string,
    content: string,
    contentType: string,
    platform: DownloadTextFilePlatform = downloadTextFilePlatformBrowser()
): void {
    const blob = new Blob([content], { type: contentType });
    const href = platform.createObjectURL(blob);
    const anchor = platform.createAnchor();
    anchor.href = href;
    anchor.download = fileName;
    platform.appendAnchor(anchor);
    anchor.click();
    anchor.remove();

    // Delay revocation so browser download streams can attach to the object URL.
    platform.schedule(() => {
        platform.revokeObjectURL(href);
    });
}

function downloadTextFilePlatformBrowser(): DownloadTextFilePlatform {
    return {
        createObjectURL: (blob) => URL.createObjectURL(blob),
        revokeObjectURL: (href) => URL.revokeObjectURL(href),
        createAnchor: () => document.createElement("a"),
        appendAnchor: (anchor) => document.body.append(anchor as unknown as Node),
        schedule: (callback) => {
            setTimeout(callback, 0);
        }
    };
}
