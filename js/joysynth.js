class JoySynth {
    constructor(aCtx, outputNode, gamepad, visualize_canvas_id, viewController) {
        this.octave = 4;
        this.waveLock = false;
        this.volLock = false;
        this.noteLock = false;
        this.delayLock = false;
        this.prevrms = [];

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
        sin.connect(sinGain);
        sinGain.connect(combiner);
        square.connect(squareGain);
        squareGain.connect(combiner);
        tri.connect(triGain);
        triGain.connect(combiner);
        saw.connect(sawGain);
        sawGain.connect(combiner);

        let lpf = aCtx.createBiquadFilter();
        lpf.type = "lowpass";
        combiner.connect(lpf);

        let delay1 = aCtx.createDelay();
        let delay2 = aCtx.createDelay();
        let delayGain1 = aCtx.createGain();
        let delayGain2 = aCtx.createGain();
        let delayIn = aCtx.createGain();
        delayGain1.gain.value = .5;
        delayGain2.gain.value = .5;
        delay1.delayTime.value = .2;
        delay2.delayTime.value = .35;
        delayIn.connect(delayGain1);
        delayIn.connect(delayGain2);
        delayGain1.connect(delay1);
        delayGain2.connect(delay2);
        delay2.connect(delayGain1);
        delay1.connect(delayGain2);

        lpf.connect(delayIn);

        let compressor = aCtx.createDynamicsCompressor();
        compressor.threshold.value = -60;
        compressor.knee.value = 40;
        compressor.ratio.value = 5;
        compressor.attack.value = 0;
        compressor.release.value = 0.25;

        lpf.connect(compressor);
        delay1.connect(compressor);
        delay2.connect(compressor);

        let analyser = aCtx.createAnalyser();
        analyser.fftSize = 2048;
        this.analyserData = new Uint8Array(analyser.frequencyBinCount);

        let gain = aCtx.createGain();
        gain.gain.value = .25;
        compressor.connect(gain);
        gain.connect(outputNode);
        gain.connect(analyser);

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
            'delayIn': delayIn,
            'gain': gain,
            'lpf': lpf,
            'compressor': compressor,
            'analyser': analyser
        };
        this.viewController = viewController;
        this.canvasId = visualize_canvas_id;

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
        if(this.buttonPressed(0)) {
            this.noteLock = !this.noteLock;
            this.viewController.noteLock(this.noteLock);
        }
        let freq;
        if(!this.noteLock) {
            freq = 440 * Math.pow(2, -4 + this.octave) * Math.pow(2, this.gamepad.axes[1] * -1);
            this.nodes.sin.frequency.value = freq;
            this.nodes.square.frequency.value = freq;
            this.nodes.tri.frequency.value = freq;
            this.nodes.saw.frequency.value = freq;
        } else {
            freq = this.nodes.sin.frequency.value;
        }

        // overall gain on RT
        if(this.buttonPressed(5)) {
            this.volLock = !this.volLock;
            this.viewController.volLock(this.volLock);
        }
        if(!this.volLock) this.nodes.lpf.frequency.value = Math.pow(this.gamepad.buttons[7].value, 3)*22000;

        // individual gains on RS
        if(this.buttonPressed(11)) {
            this.waveLock = !this.waveLock;
            this.viewController.waveLock(this.waveLock);
        }
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
        if(this.buttonPressed(4)) {
            this.delayLock = !this.delayLock;
            this.viewController.delayLock(this.delayLock);
        }
        if(!this.delayLock) this.nodes.delayIn.gain.value = Math.log2(this.gamepad.buttons[6].value+1);

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

    drawVisual(recalculate) {
        let canv = document.getElementById(this.canvasId);
        let canvasCtx = canv.getContext('2d');
        let width = canv.width;
        let height = canv.height;
        this.nodes.analyser.getByteTimeDomainData(this.analyserData);

        // if(recalculate) {
        //     let rms = this.analyserData.reduce(function(acc, val) { return acc + Math.pow(val, 2); });
        //     rms = Math.sqrt(rms/this.analyserData.length)-127;
        //     this.prevrms.push(rms);
        //
        // } else {
        //     this.prevrms.push(this.prevrms[this.prevrms.length-1]*.95);
        // }
        // let avg = this.prevrms.reduce(function(acc, val) { return acc + val })/this.prevrms.length;
        // canvasCtx.fillRect(0, 0, width*(avg/127)*1.4, height);

        if(!this.volLock) {
            canvasCtx.fillStyle = 'rgb(255, 0, 0)';
            canvasCtx.clearRect(0,0,width,height);
            canvasCtx.fillRect(0, 0, width*this.gamepad.buttons[7].value, height);
        }

        // if(this.prevrms.length > 5) this.prevrms.shift();
    };
}