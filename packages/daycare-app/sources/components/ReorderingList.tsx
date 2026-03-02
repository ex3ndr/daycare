import * as React from "react";
import { ScrollView, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    type SharedValue,
    useAnimatedProps,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withSpring
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

type ReorderingListProps<T> = {
    header?: React.ReactNode;
    footer?: React.ReactNode;
    itemHeight: number;
    gap: number;
    items: T[];
    renderItem: (item: T) => React.ReactNode;
    keyExtractor: (item: T) => string;
    onMove?: (key: string, toIndex: number) => void;
    onItemPress?: (item: T, key: string) => void;
    contentInsetTop?: number;
};

type RenderEntry<T> = {
    key: string;
    item: T;
    targetIndex: number;
};

const SPRING_CONFIG = {
    damping: 28,
    stiffness: 300,
    mass: 0.6
};

function ReorderingListComponent<T>(props: ReorderingListProps<T>) {
    const { itemHeight, gap, items, renderItem, keyExtractor } = props;

    const [renderOrderKeys, setRenderOrderKeys] = React.useState<string[]>(() =>
        items.map((item) => keyExtractor(item))
    );
    const itemKeys = React.useMemo(() => items.map((item) => keyExtractor(item)), [items, keyExtractor]);
    const itemSpan = itemHeight + gap;

    const isDragging = useSharedValue<string>("");
    const dragOffset = useSharedValue(0);
    const dragStartOffset = useSharedValue(0);
    const lastMoveIndex = useSharedValue(-1);

    React.useEffect(() => {
        const presentKeys = items.map((item) => keyExtractor(item));

        // Keep render order stable on web: changing child order while dragging can cancel
        // pointer gestures mid-flight. We only remove missing keys and append truly new keys.
        setRenderOrderKeys((previous) => {
            const next = previous.filter((key) => presentKeys.includes(key));
            for (const key of presentKeys) {
                if (!next.includes(key)) {
                    next.push(key);
                }
            }

            if (next.length === previous.length && next.every((key, index) => key === previous[index])) {
                return previous;
            }

            return next;
        });
    }, [items, keyExtractor]);

    const itemsByKey = React.useMemo(() => {
        const map = new Map<string, T>();
        for (const item of items) {
            map.set(keyExtractor(item), item);
        }
        return map;
    }, [items, keyExtractor]);

    const entries = React.useMemo<RenderEntry<T>[]>(() => {
        const keyToIndex = new Map<string, number>();
        for (let i = 0; i < items.length; i++) {
            keyToIndex.set(keyExtractor(items[i]), i);
        }

        const next: RenderEntry<T>[] = [];
        for (const key of renderOrderKeys) {
            const item = itemsByKey.get(key);
            const targetIndex = keyToIndex.get(key);
            if (item && targetIndex !== undefined) {
                next.push({
                    key,
                    item,
                    targetIndex
                });
            }
        }

        return next;
    }, [items, keyExtractor, itemsByKey, renderOrderKeys]);

    const listHeight = entries.length * itemHeight + Math.max(0, entries.length - 1) * gap;

    const tapGesture = Gesture.Tap().onEnd((event) => {
        "worklet";

        if (!props.onItemPress) {
            return;
        }

        const itemIndex = Math.floor(event.y / itemSpan);
        if (itemIndex >= 0 && itemIndex < itemKeys.length) {
            const key = itemKeys[itemIndex];
            const item = items[itemIndex];
            scheduleOnRN(props.onItemPress, item, key);
        }
    });

    const panGesture = Gesture.Pan()
        .activateAfterLongPress(400)
        .onStart((event) => {
            "worklet";
            const itemIndex = Math.floor(event.y / itemSpan);
            if (itemIndex >= 0 && itemIndex < itemKeys.length) {
                const key = itemKeys[itemIndex];
                isDragging.value = key;
                dragStartOffset.value = itemIndex * itemSpan;
                dragOffset.value = dragStartOffset.value;
                lastMoveIndex.value = itemIndex;
            }
        })
        .onUpdate((event) => {
            "worklet";
            if (isDragging.value === "") {
                return;
            }

            dragOffset.value = dragStartOffset.value + event.translationY;
            const targetIndex = Math.round(dragOffset.value / itemSpan);
            const clampedIndex = Math.max(0, Math.min(itemKeys.length - 1, targetIndex));

            if (props.onMove && clampedIndex !== lastMoveIndex.value) {
                lastMoveIndex.value = clampedIndex;
                scheduleOnRN(props.onMove, isDragging.value, clampedIndex);
            }
        })
        .onEnd(() => {
            "worklet";
            isDragging.value = "";
            lastMoveIndex.value = -1;
        });

    const composedGesture = Gesture.Exclusive(panGesture, tapGesture);

    return (
        <ScrollView
            style={{ flexBasis: 0, flexGrow: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            scrollIndicatorInsets={{ top: props.contentInsetTop || 0, bottom: 0, left: 0, right: 0 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
        >
            <View style={{ paddingTop: props.contentInsetTop || 0, paddingBottom: 24 }}>
                {props.header}
                <View style={{ height: listHeight }}>
                    <GestureDetector gesture={composedGesture}>
                        <View style={{ height: listHeight }}>
                            {entries.map((entry) => (
                                <ItemView<T>
                                    key={entry.key}
                                    id={entry.key}
                                    item={entry.item}
                                    index={entry.targetIndex}
                                    gap={gap}
                                    itemHeight={itemHeight}
                                    render={renderItem}
                                    isDragging={isDragging}
                                    dragOffset={dragOffset}
                                />
                            ))}
                        </View>
                    </GestureDetector>
                </View>
                {props.footer}
            </View>
        </ScrollView>
    );
}

export const ReorderingList = React.memo(ReorderingListComponent) as typeof ReorderingListComponent;

function ItemViewComponent<T>(props: {
    item: T;
    id: string;
    index: number;
    gap: number;
    itemHeight: number;
    render: (item: T) => React.ReactNode;
    isDragging: SharedValue<string>;
    dragOffset: SharedValue<number>;
}) {
    const topOffset = useSharedValue(props.index * (props.itemHeight + props.gap));

    React.useEffect(() => {
        topOffset.value = withSpring(props.index * (props.itemHeight + props.gap), SPRING_CONFIG);
    }, [props.index, props.itemHeight, props.gap, topOffset]);

    const isThisItemDragging = useDerivedValue(() => props.isDragging.value === props.id, [props.id]);
    const isAnyItemDragging = useDerivedValue(() => props.isDragging.value !== "");

    const translateY = useDerivedValue(() => {
        return isThisItemDragging.value ? props.dragOffset.value : topOffset.value;
    });

    const style = useAnimatedStyle(() => {
        return {
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: props.itemHeight,
            zIndex: isThisItemDragging.value ? 999 : props.index,
            transform: [
                { translateY: withSpring(translateY.value, SPRING_CONFIG) },
                { scale: withSpring(isThisItemDragging.value ? 1.04 : 1, SPRING_CONFIG) }
            ]
        };
    }, [props.itemHeight, props.index]);

    const animatedProps = useAnimatedProps(() => {
        return {
            pointerEvents: (isAnyItemDragging.value ? "none" : "auto") as "none" | "auto"
        };
    });

    return (
        <Animated.View style={style}>
            <Animated.View style={{ flex: 1 }} animatedProps={animatedProps}>
                {props.render(props.item)}
            </Animated.View>
        </Animated.View>
    );
}

const ItemView = React.memo(ItemViewComponent) as typeof ItemViewComponent;
