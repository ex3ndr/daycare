import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

export type SegmentedControlOption<T extends string = string> = {
    value: T;
    label: string;
};

export type SegmentedControlProps<T extends string = string> = {
    options: SegmentedControlOption<T>[];
    value: T;
    onChange: (value: T) => void;
};

export const SegmentedControl = React.memo(
    <T extends string = string>({ options, value, onChange }: SegmentedControlProps<T>) => {
        const { theme } = useUnistyles();

        return (
            <View style={[styles.container, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
                {options.map((option, index) => {
                    const isSelected = option.value === value;
                    const isFirst = index === 0;
                    const isLast = index === options.length - 1;

                    return (
                        <Pressable
                            key={option.value}
                            onPress={() => onChange(option.value)}
                            style={[
                                styles.option,
                                {
                                    backgroundColor: isSelected ? theme.colors.secondaryContainer : "transparent",
                                    borderTopLeftRadius: isFirst ? 8 : 0,
                                    borderBottomLeftRadius: isFirst ? 8 : 0,
                                    borderTopRightRadius: isLast ? 8 : 0,
                                    borderBottomRightRadius: isLast ? 8 : 0
                                }
                            ]}
                        >
                            <Text
                                style={[
                                    styles.label,
                                    {
                                        color: isSelected
                                            ? theme.colors.onSecondaryContainer
                                            : theme.colors.onSurfaceVariant,
                                        fontWeight: isSelected ? "600" : "400"
                                    }
                                ]}
                            >
                                {option.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        );
    }
) as <T extends string = string>(props: SegmentedControlProps<T>) => React.ReactElement;

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        borderRadius: 8,
        padding: 2,
        alignSelf: "flex-start"
    },
    option: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        minWidth: 60,
        alignItems: "center",
        justifyContent: "center"
    },
    label: {
        fontSize: 14
    }
});
