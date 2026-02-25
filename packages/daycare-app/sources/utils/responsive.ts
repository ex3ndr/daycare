export const breakpoints = {
    xs: 0,
    sm: 300,
    md: 500,
    lg: 800,
    xl: 1200
};

export type LayoutMode = "single" | "semi" | "wide";

export function layoutModeResolve(width: number): LayoutMode {
    if (width >= breakpoints.xl) {
        return "wide";
    }
    if (width >= breakpoints.lg) {
        return "semi";
    }
    return "single";
}
