import type Docker from "dockerode";

const DAYCARE_RUNTIME_IMAGE_REF = "daycare-runtime:latest";

/**
 * Resolves the current image Id (sha256 digest) for an image reference.
 * Expects: daycare-runtime:latest is available locally.
 */
export async function dockerImageIdResolve(docker: Docker): Promise<string> {
    const image = docker.getImage(DAYCARE_RUNTIME_IMAGE_REF);
    const details = await image.inspect();
    return details.Id;
}
