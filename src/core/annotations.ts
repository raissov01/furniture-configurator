/** Көрініске ғана қажет мәтін проекциясы. Өндіріс `FlatScene.nodes` оқиды. */
import { ORIGIN_POSE, composePose } from './tree'
import { isNodeHiddenByLayer } from './layers'
import type { GroupNode, Pose, SceneNode } from './tree'
import type { Layer } from './layers'

export type PlacedAnnotation = {
  nodeId: string
  text: string
  fontSize: number
  color: string
  pose: Pose
}

export function visibleAnnotations(root: GroupNode, layers: Layer[] = []): PlacedAnnotation[] {
  const result: PlacedAnnotation[] = []
  const visit = (node: SceneNode, parent: Pose): void => {
    if (node.hidden || (node !== root && layers.length > 0 && isNodeHiddenByLayer(node, layers))) return
    const pose = composePose(parent, node.transform)
    if (node.kind === 'annotation') {
      result.push({ nodeId: node.id, ...node.annotation, pose })
    } else if (node.kind === 'group') {
      node.children.forEach((child) => visit(child, pose))
    }
  }
  visit(root, ORIGIN_POSE)
  return result
}
