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

const SPRING_CONFIG = {
    damping: 28,
    stiffness: 300,
    mass: 0.6
};

function ReorderingListComponent<T>(props: ReorderingListProps<T>) {
    const { itemHeight, gap, items, renderItem, keyExtractor } = props;

    const itemKeys = React.useMemo(() => items.map((item) => keyExtractor(item)), [items, keyExtractor]);
    const itemSpan = itemHeight + gap;
    const listHeight = itemKeys.length * itemHeight + Math.max(0, itemKeys.length - 1) * gap;

    const isDragging = useSharedValue<string>("");
    const dragOffset = useSharedValue(0);
    const dragStartOffset = useSharedValue(0);
    const lastMoveIndex = useSharedValue(-1);

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
                            {items.map((item, index) => (
                                <ItemView<T>
                                    key={keyExtractor(item)}
                                    id={keyExtractor(item)}
                                    item={item}
                                    index={index}
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
