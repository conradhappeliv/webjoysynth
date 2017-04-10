let aCtx;
let lastdraw = 0;
let outputNode;
let controllers = {};
let viewModel = {
    controllers: ko.observableArray([

    ])
};

function createControllers() {
    let controllers = document.getElementsByClassName('controller');
    for(let i = 0; i < controllers.length; i++) {
        controllers[i].innerHTML = '' +
            '<div class="joystick jsleft"><div class="jsinner"></div></div>' +
            '<div class="joystick jsright"><div class="jsinner"></div></div>' +
            '<div class="button trigger tright"></div>' +
            '<div class="button trigger tleft"></div>' +
            '<div class="minibutton start"></div>' +
            '<div class="minibutton select"></div>' +
            '<div class="button shoulder shoulderright"></div>' +
            '<div class="button shoulder shoulderleft"></div>' +
            '<div class="button home"></div>' +
            '<div class="rightbuttons">' +
                '<div class="button A">A</div>' +
                '<div class="button B">B</div>' +
                '<div class="button X">X</div>' +
                '<div class="button Y">Y</div>' +
            '</div>' +
            '<div class="dpad">' +
                '<div class="button dleft"></div>' +
                '<div class="button dup"></div>' +
                '<div class="button ddown"></div>' +
                '<div class="button dright"></div>' +
            '</div>';
    }
}

function pollGamepads(timestamp) {
    requestAnimationFrame(pollGamepads);

    let curControllers = navigator.getGamepads();
    for(let i = 0; i < curControllers.length; i++) {
        if(curControllers[i] != null) {
            if(i in controllers) {
                if(!controllers[i].active) {
                    console.log("CONTROLLER: Reconnecting "+i);
                    controllers[i].reconnect(curControllers[i]);
                    viewModel.controllers()[i].connected(true)
                }
            } else {
                console.log("CONTROLLER: Connecting "+i);
                let viewController = {connected: ko.observable(true), waveLock: ko.observable(false), noteLock: ko.observable(false), volLock: ko.observable(false), delayLock: ko.observable(false)};
                viewModel.controllers.push(viewController);
                controllers[i] = new JoySynth(aCtx, outputNode, curControllers[i], 'visual_0', viewController);
            }
            controllers[i].pollGamepad();
            //controllers[i].drawVisual(true);
        } else {
            if(i in controllers && controllers[i].active) {
                console.log("CONTROLLER: Disconnecting "+i);
                controllers[i].disconnect();
                viewModel.controllers()[i].connected(false)
            }
        }
    }
    // if(timestamp - lastdraw > 1000/10) {
    //     for(let i = 0; i < curControllers.length; i++) {
    //         if(curControllers[i] != null)
    //             controllers[i].drawVisual(true);
    //     }
    //     lastdraw = timestamp;
    // } else{
    //     for(let i = 0; i < curControllers.length; i++) {
    //         if(curControllers[i] != null)
    //             controllers[i].drawVisual(false);
    //     }
    // }
}

function init() {
    aCtx = new (window.AudioContext || window.webkitAudioContext);
    outputNode = aCtx.createChannelMerger(1);
    let compressor = aCtx.createDynamicsCompressor();
    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 20;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;

    outputNode.connect(compressor);
    compressor.connect(aCtx.destination);

    requestAnimationFrame(pollGamepads);

    createControllers();

    ko.applyBindings(viewModel);
}

init();