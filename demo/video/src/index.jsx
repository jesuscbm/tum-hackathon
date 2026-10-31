import React from 'react';
import {Composition,registerRoot} from 'remotion';
import {Demo} from './Demo.jsx';
import {FPS,W,H,DURATION} from './script.mjs';

registerRoot(()=><Composition id="LokalDemo" component={Demo} durationInFrames={DURATION} fps={FPS} width={W} height={H} defaultProps={{sfx:true,demo:null}}/>);
