let aCtx;
let outputNode;
let controllers = {};

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

function pollGamepads() {
    let curControllers = navigator.getGamepads();
    for(let i = 0; i < curControllers.length; i++) {
        if(curControllers[i] != null) {
            curControllers[i].mapping = "standard";
            if(i in controllers) {
                if(!controllers[i].active) {
                    console.log("CONTROLLER: Reconnecting "+i);
                    controllers[i].reconnect(curControllers[i]);
                }
            } else {
                console.log("CONTROLLER: Connecting "+i);
                controllers[i] = new JoySynth(aCtx, outputNode, curControllers[i]);
            }
            controllers[i].pollGamepad();
        } else {
            if(i in controllers && controllers[i].active) {
                console.log("CONTROLLER: Disconnecting "+i);
                controllers[i].disconnect();
            }
        }
    }
    requestAnimationFrame(pollGamepads);
}

function init() {
    aCtx = new (window.AudioContext || window.webkitAudioContext);
    outputNode = aCtx.createChannelMerger(1);
    let compressor = aCtx.createDynamicsCompressor();
    compressor.threshold.value = -30;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;

    outputNode.connect(compressor);
    compressor.connect(aCtx.destination);

    requestAnimationFrame(pollGamepads);

    createControllers();
}

init();