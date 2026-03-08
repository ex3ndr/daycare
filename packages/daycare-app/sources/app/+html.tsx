import { ScrollViewStyleReset } from "expo-router/html";
import "../unistyles";

const fontFiles = [
    "IBMPlexSans-Thin",
    "IBMPlexSans-ThinItalic",
    "IBMPlexSans-ExtraLight",
    "IBMPlexSans-ExtraLightItalic",
    "IBMPlexSans-Light",
    "IBMPlexSans-LightItalic",
    "IBMPlexSans-Regular",
    "IBMPlexSans-Italic",
    "IBMPlexSans-Text",
    "IBMPlexSans-TextItalic",
    "IBMPlexSans-Medium",
    "IBMPlexSans-MediumItalic",
    "IBMPlexSans-SemiBold",
    "IBMPlexSans-SemiBoldItalic",
    "IBMPlexSans-Bold",
    "IBMPlexSans-BoldItalic",
    "IBMPlexMono-Regular",
    "IBMPlexMono-Italic",
    "IBMPlexMono-SemiBold",
    "BricolageGrotesque-Bold",
    "SpaceMono-Regular"
];

/** Icon fonts from @expo/vector-icons — preload only, @font-face registered at runtime */
const iconFontFiles = ["Octicons", "Ionicons"];

const fontFaceCss = fontFiles
    .map(
        (name) =>
            `@font-face { font-family: "${name}"; src: url("/fonts/${name}.ttf") format("truetype"); font-display: swap; }`
    )
    .join("\n");

export default function Root({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
                {[...fontFiles, ...iconFontFiles].map((name) => (
                    <link
                        key={name}
                        rel="preload"
                        href={`/fonts/${name}.ttf`}
                        as="font"
                        type="font/ttf"
                        crossOrigin="anonymous"
                    />
                ))}
                <ScrollViewStyleReset />
                <style>{fontFaceCss}</style>
                <style>{responsiveBackground}</style>
            </head>
            <body>{children}</body>
        </html>
    );
}

// Match surfaceContainerLow from the app theme to avoid a flash on load
const responsiveBackground = `
body {
  background-color: #F9F3E9;
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: #1C1A15;
  }
}`;
