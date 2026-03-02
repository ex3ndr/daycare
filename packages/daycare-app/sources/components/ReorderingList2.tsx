import * as React from "react";
import { Animated, PanResponder, type PanResponderInstance, ScrollView, View } from "react-native";

type ReorderingList2Props<T> = {
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

const LONG_PRESS_DURATION = 400;

function ReorderingList2Component<T>(props: ReorderingList2Props<T>) {
    const { itemHeight, gap, items, keyExtractor } = props;

    const itemKeys = React.useMemo(() => items.map((item) => keyExtractor(item)), [items, keyExtractor]);
    const itemSpan = itemHeight + gap;
    const listHeight = itemKeys.length * itemHeight + Math.max(0, itemKeys.length - 1) * gap;

    const itemKeysRef = React.useRef(itemKeys);
    const itemsRef = React.useRef(items);
    const itemSpanRef = React.useRef(itemSpan);

    React.useEffect(() => {
        itemKeysRef.current = itemKeys;
        itemsRef.current = items;
        itemSpanRef.current = itemSpan;
    }, [itemKeys, items, itemSpan]);

    const containerViewRef = React.useRef<View | null>(null);
    const containerPageY = React.useRef(0);

    const isDraggingKey = React.useRef<string>("");
    const dragOffset = React.useRef(new Animated.Value(0)).current;
    const dragStartOffset = React.useRef(0);
    const lastMoveIndex = React.useRef(-1);
    const [draggingKey, setDraggingKey] = React.useState<string>("");

    const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const touchStartTime = React.useRef(0);

    const clearLongPressTimer = React.useCallback(() => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    }, []);

    const updateContainerPosition = React.useCallback((callback?: (pageY: number) => void) => {
        if (!containerViewRef.current) {
            callback?.(containerPageY.current);
            return;
        }

        containerViewRef.current.measure(
            (_x: number, _y: number, _width: number, _height: number, _pageX: number, pageY: number) => {
                containerPageY.current = pageY;
                callback?.(pageY);
            }
        );
    }, []);

    const startDragFromTouchY = React.useCallback(
        (touchY: number) => {
            clearLongPressTimer();

            longPressTimer.current = setTimeout(() => {
                const span = itemSpanRef.current;
                const keys = itemKeysRef.current;
                const itemIndex = Math.floor(touchY / span);

                if (itemIndex >= 0 && itemIndex < keys.length) {
                    const key = keys[itemIndex];
                    isDraggingKey.current = key;
                    setDraggingKey(key);
                    dragStartOffset.current = itemIndex * span;
                    dragOffset.setValue(dragStartOffset.current);
                    lastMoveIndex.current = itemIndex;
                }
            }, LONG_PRESS_DURATION);
        },
        [clearLongPressTimer, dragOffset]
    );

    React.useEffect(() => {
        return () => {
            clearLongPressTimer();
        };
    }, [clearLongPressTimer]);

    const panResponder = React.useRef<PanResponderInstance>(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => isDraggingKey.current !== "",
            onPanResponderGrant: (event) => {
                touchStartTime.current = Date.now();

                const pageY = event.nativeEvent.pageY;
                updateContainerPosition((containerY) => {
                    const touchY = pageY - containerY;
                    startDragFromTouchY(touchY);
                });
            },
            onPanResponderMove: (_event, gestureState) => {
                if (isDraggingKey.current !== "") {
                    const nextOffset = dragStartOffset.current + gestureState.dy;
                    dragOffset.setValue(nextOffset);

                    const span = itemSpanRef.current;
                    const keys = itemKeysRef.current;
                    const targetIndex = Math.round(nextOffset / span);
                    const clampedIndex = Math.max(0, Math.min(keys.length - 1, targetIndex));

                    if (props.onMove && clampedIndex !== lastMoveIndex.current) {
                        lastMoveIndex.current = clampedIndex;
                        props.onMove(isDraggingKey.current, clampedIndex);
                    }
                    return;
                }

                if (Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10) {
                    clearLongPressTimer();
                }
            },
            onPanResponderRelease: (event) => {
                clearLongPressTimer();

                if (isDraggingKey.current !== "") {
                    isDraggingKey.current = "";
                    setDraggingKey("");
                    lastMoveIndex.current = -1;
                    return;
                }

                const touchDuration = Date.now() - touchStartTime.current;
                if (touchDuration < LONG_PRESS_DURATION && props.onItemPress) {
                    const pageY = event.nativeEvent.pageY;
                    updateContainerPosition((containerY) => {
                        const span = itemSpanRef.current;
                        const touchY = pageY - containerY;
                        const itemIndex = Math.floor(touchY / span);

                        const keys = itemKeysRef.current;
                        const currentItems = itemsRef.current;
                        if (itemIndex >= 0 && itemIndex < keys.length) {
                            props.onItemPress?.(currentItems[itemIndex], keys[itemIndex]);
                        }
                    });
                }
            },
            onPanResponderTerminate: () => {
                clearLongPressTimer();
                isDraggingKey.current = "";
                setDraggingKey("");
                lastMoveIndex.current = -1;
            }
        })
    ).current;

    return (
        <ScrollView
            style={{ flexBasis: 0, flexGrow: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            scrollIndicatorInsets={{ top: props.contentInsetTop || 0, bottom: 0, left: 0, right: 0 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            scrollEnabled={draggingKey === ""}
        >
            <View style={{ paddingTop: props.contentInsetTop || 0, paddingBottom: 24 }}>
                {props.header}
                <View style={{ height: listHeight }}>
                    <Animated.View
                        ref={containerViewRef}
                        {...panResponder.panHandlers}
                        onLayout={() => updateContainerPosition()}
                        style={{ height: listHeight }}
                    >
                        {items.map((item, index) => (
                            <ItemView2<T>
                                key={keyExtractor(item)}
                                id={keyExtractor(item)}
                                item={item}
                                index={index}
                                gap={gap}
                                itemHeight={itemHeight}
                                render={props.renderItem}
                                dragOffset={dragOffset}
                                draggingKey={draggingKey}
                            />
                        ))}
                    </Animated.View>
                </View>
                {props.footer}
            </View>
        </ScrollView>
    );
}

export const ReorderingList2 = React.memo(ReorderingList2Component) as typeof ReorderingList2Component;

function ItemView2Component<T>(props: {
    item: T;
    id: string;
    index: number;
    gap: number;
    itemHeight: number;
    render: (item: T) => React.ReactNode;
    dragOffset: Animated.Value;
    draggingKey: string;
}) {
    const topOffset = React.useRef(new Animated.Value(props.index * (props.itemHeight + props.gap))).current;
    const scale = React.useRef(new Animated.Value(1)).current;
    const dragWeight = React.useRef(new Animated.Value(0)).current;

    const isDraggingThisItem = props.draggingKey === props.id;

    React.useEffect(() => {
        Animated.spring(topOffset, {
            toValue: props.index * (props.itemHeight + props.gap),
            speed: 14,
            bounciness: 4,
            useNativeDriver: true
        }).start();
    }, [props.index, props.itemHeight, props.gap, topOffset]);

    React.useEffect(() => {
        Animated.spring(scale, {
            toValue: isDraggingThisItem ? 1.04 : 1,
            speed: 14,
            bounciness: 4,
            useNativeDriver: true
        }).start();

        Animated.timing(dragWeight, {
            toValue: isDraggingThisItem ? 1 : 0,
            duration: 0,
            useNativeDriver: true
        }).start();
    }, [isDraggingThisItem, scale, dragWeight]);

    const translateY = Animated.add(
        Animated.multiply(topOffset, Animated.add(1, Animated.multiply(dragWeight, -1))),
        Animated.multiply(props.dragOffset, dragWeight)
    );

    const style = {
        position: "absolute" as const,
        top: 0,
        left: 0,
        right: 0,
        height: props.itemHeight,
        zIndex: isDraggingThisItem ? 999 : props.index,
        transform: [{ translateY }, { scale }]
    };

    return (
        <Animated.View style={style}>
            <Animated.View style={{ flex: 1 }} pointerEvents={props.draggingKey ? "none" : "auto"}>
                {props.render(props.item)}
            </Animated.View>
        </Animated.View>
    );
}

const ItemView2 = React.memo(ItemView2Component) as typeof ItemView2Component;
