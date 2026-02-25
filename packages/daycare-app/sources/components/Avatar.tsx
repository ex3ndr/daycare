import { Image } from "expo-image";
import * as React from "react";
import { AvatarBrutalist } from "./AvatarBrutalist";

interface AvatarProps {
    id: string;
    title?: boolean;
    square?: boolean;
    size?: number;
    monochrome?: boolean;
    imageUrl?: string | null;
    thumbhash?: string | null;
}

export const Avatar = React.memo((props: AvatarProps) => {
    const { size = 48, imageUrl, thumbhash, ...avatarProps } = props;

    if (imageUrl) {
        return (
            <Image
                source={{ uri: imageUrl, thumbhash: thumbhash || undefined }}
                placeholder={thumbhash ? { thumbhash } : undefined}
                contentFit="cover"
                style={{
                    width: size,
                    height: size,
                    borderRadius: avatarProps.square ? 0 : size / 2
                }}
            />
        );
    }

    return <AvatarBrutalist {...avatarProps} size={size} />;
});
