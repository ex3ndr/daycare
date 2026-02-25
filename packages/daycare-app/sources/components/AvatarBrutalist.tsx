import * as React from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

interface AvatarBrutalistProps {
    id: string;
    title?: boolean;
    square?: boolean;
    size?: number;
    monochrome?: boolean;
}

function colorFromId(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i += 1) {
        hash = (hash << 5) - hash + id.charCodeAt(i);
        hash |= 0;
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue} 65% 55%)`;
}

export const AvatarBrutalist = React.memo((props: AvatarBrutalistProps) => {
    const size = props.size ?? 48;
    const bg = props.monochrome ? "#9aa0a6" : colorFromId(props.id);
    const initials = props.id.slice(0, 2).toUpperCase();

    return (
        <View
            style={[
                styles.root,
                {
                    width: size,
                    height: size,
                    borderRadius: props.square ? 6 : size / 2,
                    backgroundColor: bg
                }
            ]}
        >
            <Text style={styles.text}>{initials || "DY"}</Text>
        </View>
    );
});

const styles = StyleSheet.create(() => ({
    root: {
        alignItems: "center",
        justifyContent: "center"
    },
    text: {
        color: "white",
        fontSize: 12,
        fontWeight: "700"
    }
}));
