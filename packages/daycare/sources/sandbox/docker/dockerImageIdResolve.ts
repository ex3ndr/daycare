import type Docker from "dockerode";

/**
 * Resolves the current image Id (sha256 digest) for an image reference.
 * Expects: imageRef points to a locally available Docker image.
 */
export async function dockerImageIdResolve(docker: Docker, imageRef: string): Promise<string> {
    const image = docker.getImage(imageRef);
    const details = await image.inspect();
    return details.Id;
}
