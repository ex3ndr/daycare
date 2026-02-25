import * as React from "react";
import { View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { TreePanelLayoutSemiWide } from "./TreePanelLayoutSemiWide";
import { TreePanelLayoutWide } from "./TreePanelLayoutWide";

export type TreePanelLayoutProps = {
    panel1: React.ReactNode;
    panel2: React.ReactNode;
    panel3?: React.ReactNode;
    panel3Placeholder?: React.ReactNode;
    onClosePanel3?: () => void;
};

export const TreePanelLayout = React.memo<TreePanelLayoutProps>(
    ({ panel1, panel2, panel3, panel3Placeholder, onClosePanel3 }) => {
        const { rt } = useUnistyles();

        // Wide screen (xl): All 3 panels visible, panel 3 or placeholder
        if (rt.breakpoint === "xl") {
            return (
                <View style={{ flex: 1, minWidth: 1024 }}>
                    <TreePanelLayoutWide
                        panel1={panel1}
                        panel2={panel2}
                        panel3={panel3}
                        panel3Placeholder={panel3Placeholder || null}
                        onClosePanel3={onClosePanel3}
                    />
                </View>
            );
        }

        // Semi-wide screen (lg and below): Panels 1 & 2 visible, panel 3 as drawer
        return (
            <View style={{ flex: 1, minWidth: 1024 }}>
                <TreePanelLayoutSemiWide
                    panel1={panel1}
                    panel2={panel2}
                    panel3={panel3}
                    onClosePanel3={onClosePanel3}
                />
            </View>
        );
    }
);
