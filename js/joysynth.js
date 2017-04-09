class JoySynth {
    constructor(aCtx, gamepad) {
        this.octave = 4;
        this.waveLock = false;

        let sin = aCtx.createOscillator();
        let sinGain = aCtx.createGain();
        sin.type = 'sine';
        sinGain.gain.value = 1;
        let square = aCtx.createOscillator();
        let squareGain = aCtx.createGain();
        square.type = 'square';
        squareGain.gain.value = 1;
        let tri = aCtx.createOscillator();
        let triGain = aCtx.createGain();
        tri.type = 'triangle';
        triGain.gain.value = 1;
        let saw = aCtx.createOscillator();
        let sawGain = aCtx.createGain();
        saw.type = 'sawtooth';
        sawGain.gain.value = 1;

        let mod_LFO = aCtx.createOscillator();
        let mod_LFOGain = aCtx.createGain();
        mod_LFOGain.gain.value = 0;
        mod_LFO.type = 'sine';
        mod_LFO.frequency.value = 4;
        mod_LFO.connect(mod_LFOGain);
        mod_LFOGain.connect(sin.frequency);
        mod_LFOGain.connect(saw.frequency);
        mod_LFOGain.connect(tri.frequency);
        mod_LFOGain.connect(square.frequency);
        mod_LFO.start();

        let combiner = aCtx.createChannelMerger(1);
        //     aCtx.createScriptProcessor(256, 4, 1);
        // combiner.onaudioprocess = function(e) {
        //     let input = e.inputBuffer;
        //     let output = e.outputBuffer.getChannelData(0);
        //     for(let i = 0; i < input.length; i++) {
        //         output[i] = (
        //                 input.getChannelData(0)[i] +
        //                 input.getChannelData(1)[i] +
        //                 input.getChannelData(2)[i] +
        //                 input.getChannelData(3)[i]
        //         )*.25;
        //     }
        // };
        sin.connect(sinGain);
        sinGain.connect(combiner);
        square.connect(squareGain);
        squareGain.connect(combiner);
        tri.connect(triGain);
        triGain.connect(combiner);
        saw.connect(sawGain);
        sawGain.connect(combiner);


        let gain = aCtx.createGain();
        gain.gain.value = 1;
        combiner.connect(gain);

        let delay1 = aCtx.createDelay();
        let delay2 = aCtx.createDelay();
        let delayGain1 = aCtx.createGain();
        let delayGain2 = aCtx.createGain();
        delayGain1.gain.value = 0;
        delayGain2.gain.value = 0;
        delay1.delayTime.value = .2;
        delay2.delayTime.value = .35;
        delayGain1.connect(delay1);
        delayGain2.connect(delay2);

        gain.connect(delayGain1);
        gain.connect(delayGain2);

        let compressor = aCtx.createDynamicsCompressor();
        compressor.threshold.value = -30;
        compressor.knee.value = 40;
        compressor.ratio.value = 12;
        compressor.attack.value = 0;
        compressor.release.value = 0.25;

        gain.connect(compressor);
        delay1.connect(compressor);
        delay2.connect(compressor);
        compressor.connect(aCtx.destination);

        sin.start();
        square.start();
        tri.start();
        saw.start();

        this.nodes = {
            'sin': sin,
            'sinGain': sinGain,
            'square': square,
            'squareGain': squareGain,
            'tri': tri,
            'triGain': triGain,
            'saw': saw,
            'sawGain': sawGain,
            'mod_LFO': mod_LFO,
            'mod_LFOGain': mod_LFOGain,
            'combiner': combiner,
            'delay1': delay1,
            'delay2': delay2,
            'delayGain1': delayGain1,
            'delayGain2': delayGain2,
            'gain': gain
        };

        this.reconnect(gamepad);
        this.savePreviousState();
    }

    reconnect(gamepad) {
        this.active = true;
        this.gamepad = gamepad;
    }

    disconnect() {
        this.active = false;
    }

    pollGamepad() {
        // axes:
        //   L: UD -> 1, LR -> 0
        //   R: UD -> 3, LR -> 2
        // buttons:
        //    A B X Y LB RB LT RT SEL STA LJS RJS U D L R HOME

        // overall frequency
        let freq = 440 * Math.pow(2, -4 + this.octave) * Math.pow(2, this.gamepad.axes[1]*-1);
        this.nodes.sin.frequency.value = freq;
        this.nodes.square.frequency.value = freq;
        this.nodes.tri.frequency.value = freq;
        this.nodes.saw.frequency.value = freq;

        // overall gain on RT
        this.nodes.gain.gain.value = this.gamepad.buttons[7].value;

        // individual gains on RS
        if(this.buttonPressed(11)) this.waveLock = !this.waveLock;
        if(!this.waveLock) {
            this.nodes.sinGain.gain.value =     (this.gamepad.axes[2] + 1) / 2;
            this.nodes.sawGain.gain.value =     (this.gamepad.axes[2] - 1) / -2;
            this.nodes.squareGain.gain.value =  (this.gamepad.axes[3] + 1) / 2;
            this.nodes.triGain.gain.value =     (this.gamepad.axes[3] - 1) / -2;
        }

        // octave up/down on X/Y
        if(this.buttonPressed(3)) this.octave = Math.min(this.octave+1, 8);
        if(this.buttonPressed(2)) this.octave = Math.max(this.octave-1, -2);

        // modulation
        if(this.gamepad.buttons[10].pressed) this.nodes.mod_LFOGain.gain.value = .05*freq;
        if(this.buttonReleased(10)) this.nodes.mod_LFOGain.gain.value = 0;

        // delay
        this.nodes.delayGain1.gain.value = this.gamepad.buttons[6].value * .5;
        this.nodes.delayGain2.gain.value = this.gamepad.buttons[6].value * .2;


        this.savePreviousState();
    }

    savePreviousState() {
        this.oldButtons = this.gamepad.buttons.map(function(e) { return e.value });
    }

    buttonPressed(buttonnum) {
        return (this.oldButtons[buttonnum] == 0 && this.gamepad.buttons[buttonnum].value > 0);
    }

    buttonReleased(buttonnum) {
        return (this.oldButtons[buttonnum] > 0 && this.gamepad.buttons[buttonnum].value == 0);
    }
}