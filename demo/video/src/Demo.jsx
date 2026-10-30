import React from 'react';
import {AbsoluteFill,Easing} from 'remotion';
import {TransitionSeries,linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {SCENES} from './script.mjs';
import {SfxOn} from './lib.jsx';
import {Backdrop,CRT,Narrator} from './frame.jsx';
import {Intro} from './scenes/Intro.jsx';
import {Chaos} from './scenes/Chaos.jsx';
import {Command} from './scenes/Command.jsx';
import {Wizard} from './scenes/Wizard.jsx';
import {Flow} from './scenes/Flow.jsx';
import {Gate} from './scenes/Gate.jsx';
import {LiveDemo} from './scenes/LiveDemo.jsx';
import {Outro} from './scenes/Outro.jsx';

const PARTS={intro:Intro,chaos:Chaos,command:Command,wizard:Wizard,flow:Flow,gate:Gate,demo:LiveDemo,outro:Outro};
// Crossfade length. Every scene but the last runs T frames longer than its slot, so scene starts stay where
// script.mjs puts them and the voice-over timings don't move.
const T=20,timing=linearTiming({durationInFrames:T,easing:Easing.inOut(Easing.cubic)}),crossfade=fade({shouldFadeOutExitingScene:true});

export function Demo({sfx=true,demo=null}){
 const ids=Object.keys(SCENES);
 return <SfxOn.Provider value={sfx}>
  <AbsoluteFill>
   <Backdrop/>
   <TransitionSeries>
    {ids.flatMap((id,i)=>{const [a,b]=SCENES[id],Scene=PARTS[id],last=i===ids.length-1;
     return [<TransitionSeries.Sequence key={id} name={id} durationInFrames={b-a+(last?0:T)}><Scene src={demo}/></TransitionSeries.Sequence>,
      ...(last?[]:[<TransitionSeries.Transition key={id+'>'} presentation={crossfade} timing={timing}/>])]})}
   </TransitionSeries>
   <Narrator/>
   <CRT/>
  </AbsoluteFill>
 </SfxOn.Provider>;
}
