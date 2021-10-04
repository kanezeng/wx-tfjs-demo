import { Matcher } from './image-target/matching/matcher';
import { Estimator } from './image-target/estimation/estimator';

let projectionTransform = null;
let matchingDataList = null;
let debugMode = false;
let matcher = null;
let estimator = null;

const postMessage = (data, callback) => {
  callback({data});
};

export class Worker {
  public onmessage = (e: any)=>{console.log('message', e)};

  postMessage (data) {
    this.processMessage({data});
  }

  processMessage (msg) {
    const {data} = msg;

    if (data.type === 'setup') {
      projectionTransform = data.projectionTransform;
      matchingDataList = data.matchingDataList;
      debugMode = data.debugMode;
      matcher = new Matcher(data.inputWidth, data.inputHeight, debugMode);
      estimator = new Estimator(data.projectionTransform);
    }
    else if (data.type === 'match') {
      const skipTargetIndexes = data.skipTargetIndexes;

      let matchedTargetIndex = -1;
      let matchedModelViewTransform = null;
      let debugExtras = null;

      if (debugMode) {
        debugExtras = [];
      }

      for (let i = 0; i < matchingDataList.length; i++) {
        if (skipTargetIndexes.includes(i)) continue;

        const {keyframeIndex, screenCoords, worldCoords, debugExtra} = matcher.matchDetection(matchingDataList[i], data.featurePoints);

        if (debugMode) {
          debugExtras.push(debugExtra);
        }

        if (keyframeIndex === -1) continue;

        const modelViewTransform = estimator.estimate({screenCoords, worldCoords});
        if (modelViewTransform === null) continue;

        matchedTargetIndex = i;
        matchedModelViewTransform = modelViewTransform;
        break;
      }

      postMessage({
        type: 'matchDone',
        targetIndex: matchedTargetIndex,
        modelViewTransform: matchedModelViewTransform,
        debugExtras
      }, this.onmessage);
    }
    else if (data.type === 'trackUpdate') {
      const {modelViewTransform, worldCoords, screenCoords} = data;
      const finalModelViewTransform = estimator.refineEstimate({initialModelViewTransform: modelViewTransform, worldCoords, screenCoords});
      postMessage({
        type: 'trackUpdateDone',
        modelViewTransform: finalModelViewTransform,
      }, this.onmessage);
    }
  }
};
