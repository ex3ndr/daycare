import type * as React from "react";
import renderer from "react-test-renderer";

/** Renders a React element inside react-test-renderer act(). */
export function testRender(element: React.ReactElement): renderer.ReactTestRenderer {
    let tree: renderer.ReactTestRenderer | undefined;
    renderer.act(() => {
        tree = renderer.create(element);
    });

    if (tree === undefined) {
        throw new Error("Renderer failed to mount test element");
    }

    return tree;
}
