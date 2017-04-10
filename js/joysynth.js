function closest(num, arr) { // http://stackoverflow.com/a/8584940/2414841
    let mid;
    let lo = 0;
    let hi = arr.length - 1;
    while (hi - lo > 1) {
        mid = Math.floor((lo + hi) / 2);
        if (arr[mid] < num) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    if (num - arr[lo] <= arr[hi] - num) {
        return arr[lo];
    }
    return arr[hi];
}

class JoySynth {
    constructor(aCtx, outputNode, gamepad, visualize_canvas_id, viewController) {
        this.octave = 4;
        this.waveLock = false;
        this.volLock = false;
        this.noteLock = false;
        this.delayLock = false;
        this.pitchSnap = false;
        this.curScale = 0;
        this.prevrms = [];
        this.pitchRatios = [1, 16./15, 1.125, 1.2, 1.25, 4./3, 45. / 32, 1.5, 1.6, 5./3, 1.8, 1.875];
        this.scales = [
            {name: 'major', notes: [0, 2, 4, 5, 7, 9, 11]},
            {name: 'minor', notes: [0, 2, 3, 5, 7, 8, 10]},
            {name: 'jazz', notes: [0, 3, 5, 6, 7, 10, 11]},
            {name: 'chromatic', notes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]},
            {name: 'whole note', notes: [0, 2, 4, 6, 8, 10]}
        ];

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
        //    A B X Y LB 5RB LT RT SEL STA 10LJS RJS U D L R HOME

        // pitch snapping
        if(this.buttonPressed(9)) {
            this.pitchSnap = !this.pitchSnap;
            this.viewController.pitchSnap(this.scales[this.curScale].name);
        }
        if(this.buttonPressed(12)) {
            this.curScale++;
            if(this.curScale == this.scales.length) this.curScale = 0;
            this.viewController.scaleName(this.scales[this.curScale].name);
        }
        if(this.buttonPressed(13)) {
            this.curScale--;
            if(this.curScale < 0) this.curScale = this.scales.length-1;
            this.viewController.scaleName(this.scales[this.curScale].name);
        }

        // overall frequency
        if(this.buttonPressed(0)) {
            this.noteLock = !this.noteLock;
            this.viewController.noteLock(this.noteLock);
        }
        let freq;
        if(!this.noteLock) {
            freq = 440 * Math.pow(2, -4 + this.octave) * Math.pow(2, this.gamepad.axes[1] * -1);
            if(this.pitchSnap) {
                let self = this;
                let curRatios = this.pitchRatios.filter(function(val, ind) { return self.scales[self.curScale].notes.indexOf(ind) != -1; });
                let oct = Math.floor(Math.log2(freq/440));
                let ratio = closest(freq/(440*Math.pow(2, oct)), curRatios);
                freq = 440 * Math.pow(2, oct) * ratio;
            }

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