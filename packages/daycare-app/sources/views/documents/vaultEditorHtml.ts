type ThemeColors = {
    onSurface: string;
    surface: string;
    onSurfaceVariant: string;
    outlineVariant: string;
    surfaceContainerHigh: string;
    primary: string;
};

/**
 * Generates an editable HTML document with contenteditable body and postMessage communication.
 * The parent window sends commands (bold, italic, etc.) via postMessage.
 * The iframe posts content changes back as { type: "content", html: "..." }.
 *
 * Expects: initialHtml is rendered markdown HTML; colors come from the app theme.
 */
export function vaultEditorHtml(initialHtml: string, colors: ThemeColors): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.6;
    color: ${colors.onSurface};
    background: ${colors.surface};
    padding: 20px;
    word-wrap: break-word;
    overflow-wrap: break-word;
    min-height: 100%;
}
body {
    outline: none;
}
body:empty::before {
    content: "Start typing...";
    color: ${colors.onSurfaceVariant};
    opacity: 0.5;
}
h1, h2, h3, h4, h5, h6 {
    margin-top: 1.4em;
    margin-bottom: 0.6em;
    font-weight: 600;
    line-height: 1.3;
}
h1 { font-size: 1.7em; }
h2 { font-size: 1.4em; }
h3 { font-size: 1.2em; }
h4 { font-size: 1.05em; }
h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
p { margin-bottom: 0.8em; }
a { color: ${colors.primary}; text-decoration: none; }
a:hover { text-decoration: underline; }
code {
    font-family: "SF Mono", Monaco, Menlo, Consolas, monospace;
    font-size: 0.88em;
    background: ${colors.surfaceContainerHigh};
    padding: 2px 5px;
    border-radius: 4px;
}
pre {
    background: ${colors.surfaceContainerHigh};
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 1em;
    overflow-x: auto;
}
pre code {
    background: none;
    padding: 0;
    font-size: 0.85em;
    line-height: 1.5;
}
blockquote {
    border-left: 3px solid ${colors.outlineVariant};
    padding-left: 14px;
    margin-bottom: 1em;
    color: ${colors.onSurfaceVariant};
}
ul, ol {
    margin-bottom: 1em;
    padding-left: 1.8em;
}
li { margin-bottom: 0.3em; }
table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1em;
}
th, td {
    border: 1px solid ${colors.outlineVariant};
    padding: 8px 12px;
    text-align: left;
}
th {
    background: ${colors.surfaceContainerHigh};
    font-weight: 600;
}
hr {
    border: none;
    border-top: 1px solid ${colors.outlineVariant};
    margin: 1.5em 0;
}
img { max-width: 100%; height: auto; border-radius: 4px; }
</style>
</head>
<body contenteditable="true">${initialHtml}</body>
<script>
(function() {
    var debounceTimer = null;
    function notifyChange() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
            window.parent.postMessage({ type: "content", html: document.body.innerHTML }, "*");
        }, 300);
    }

    document.body.addEventListener("input", notifyChange);

    window.addEventListener("message", function(event) {
        var data = event.data;
        if (!data || !data.type) return;

        if (data.type === "command") {
            document.execCommand(data.command, false, data.value || null);
            notifyChange();
        }

        if (data.type === "formatBlock") {
            document.execCommand("formatBlock", false, data.tag);
            notifyChange();
        }

        if (data.type === "setContent") {
            document.body.innerHTML = data.html;
        }
    });

    // Keyboard shortcuts
    document.body.addEventListener("keydown", function(e) {
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
            switch (e.key) {
                case "b":
                    e.preventDefault();
                    document.execCommand("bold");
                    notifyChange();
                    break;
                case "i":
                    e.preventDefault();
                    document.execCommand("italic");
                    notifyChange();
                    break;
                case "u":
                    e.preventDefault();
                    document.execCommand("underline");
                    notifyChange();
                    break;
            }
        }
    });
})();
</script>
</html>`;
}
