import * as posedetection from '@tensorflow-models/pose-detection'
import '@tensorflow/tfjs'

export async function createMoveNetDetector() {
  const model = posedetection.SupportedModels.MoveNet
  return await posedetection.createDetector(model, {
    modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    enableSmoothing: true,
  })
}