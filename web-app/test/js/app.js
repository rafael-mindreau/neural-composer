/**
 * Created by Rafael on 1/12/2016.
 */

'use strict';

var NeuralComposer = {};

NeuralComposer.init = function() {
    // Set Terminal to work
    NeuralComposer.$console = $('#console');

    // Audio init
    NeuralComposer.mixer.gain = NeuralComposer.audioContext.createGain();
    NeuralComposer.mixer.gain.connect(NeuralComposer.audioContext.destination);

    NeuralComposer.mixer.gain.gain.value = 0.5;

    // Midi
    navigator.requestMIDIAccess().then(midi => {
        NeuralComposer.midi = midi;
        NeuralComposer.log('Browser supports MIDI!');

        NeuralComposer.initMidi();
    }, () => NeuralComposer.log('Could not initialize MIDI!'));
};

NeuralComposer.initNetwork = function() {
    // Network buttons
    $('#btnNetworkStart').on('click', NeuralComposer.startListening);
    $('#btnNetworkStop').on('click', NeuralComposer.stopListening);
    $('#btnNetworkNew').on('click', NeuralComposer.newNetwork);
    $('#btnNetworkReply').on('click', NeuralComposer.replyNetwork);
};

NeuralComposer.initTrainer = function() {
    // Init Trainer Module
    $('#openTrainingDataFile').change(function() {
        NeuralComposer.loadFile($('#openTrainingDataFile').val());
    });


};

NeuralComposer.log = function(txt) {
    if (NeuralComposer.$console != null) {
        NeuralComposer.$console.append('<p>' + txt + '</p>');
        NeuralComposer.$console.get(0).scrollTop = NeuralComposer.$console.get(0).scrollHeight;
    }
};

/**
 * App specific parameters
 */
NeuralComposer.logParameterChanges = false;
NeuralComposer.logEvents= true;

$(document).ready(function() {
    /* Setup */
    NeuralComposer.init();
    NeuralComposer.initNetwork();
    NeuralComposer.initTrainer();

    // Init Osc Components
    NeuralComposer.makeKnob($('#oscType'), NeuralComposer.changeOscillatorType);
    NeuralComposer.makeKnob($('#oscDetune'), NeuralComposer.changeOscTuning);
    NeuralComposer.makeKnob($('#oscGain'), NeuralComposer.changeGain);

    // Init Trainer Components
    NeuralComposer.makeKnob($('#error'), NeuralComposer.changeError);
    NeuralComposer.makeKnob($('#learningRate'), NeuralComposer.changeLearningRate);
    NeuralComposer.makeKnob($('#delay'), NeuralComposer.changeDelay);

    // Init Training Data Module
    $('#btnTrainingDataStart').on('click', NeuralComposer.startTrainingData);
    $('#btnTrainingDataStop').on('click', NeuralComposer.stopTrainingData);
    $('#btnSaveTrainingData').on('click', (e) => {
        e.preventDefault();
        NeuralComposer.saveFile(NeuralComposer.trainingData)
    });

    $('#btnClearTrainingData').on('click', function(e) {
        e.preventDefault();

        NeuralComposer.trainingData = [];
        NeuralComposer.trainingData.push({});

        NeuralComposer.log('Training data has been discarded');

        $('#trainingDataLoadedLed').removeClass('active');

        // Clearing input filename causes event, so unbind & rebind
        $('#openTrainingDataFile').unbind().val('').change(function() {
            NeuralComposer.loadFile($('#openTrainingDataFile').val());
        });
    });

    // Training start
    $('#btnStartTraining').on('click', NeuralComposer.startTraining);

/*
    NeuralComposer.log('Generating training set for Trainer...');
    var trainingSet = [
        {
            //      C C#D D#E F F#G G#A A#B
            input: [1,0,0,0,0,0,0,0,0,0,0,0],
            output:[0,0,0,0,1,0,0,0,0,0,0,0]
        },
        {
            //      C C#D D#E F F#G G#A A#B
            input: [1,0,0,0,0,0,0,0,0,0,0,0],
            output:[0,0,0,0,0,0,0,1,0,0,0,0]
        },
        {
            //      C C#D D#E F F#G G#A A#B
            input: [0,0,0,0,1,0,0,0,0,0,0,0],
            output:[0,0,0,0,0,0,0,1,0,0,0,0]
        },
        {
            //      C C#D D#E F F#G G#A A#B
            input: [0,0,0,0,0,0,0,1,0,0,0,0],
            output:[1,0,0,0,0,0,0,0,0,0,0,0]
        },
        {
            //      C C#D D#E F F#G G#A A#B
            input: [0,0,0,0,1,0,0,0,0,0,0,0],
            output:[1,0,0,0,0,0,0,0,0,0,0,0]
        },
        {
            //      C C#D D#E F F#G G#A A#B
            input: [0,0,1,0,0,0,1,0,0,0,1,0],
            output:[0,0,0,0,0,0,0,0,0,0,0,0]
        },
        {
            //      C C#D D#E F F#G G#A A#B
            input: [0,0,0,0,0,0,0,0,0,0,0,0],
            output:[0,0,0,0,0,0,0,0,0,0,0,0]
        },
        {
            //      C C#D D#E F F#G G#A A#B
            input: [0,0,0,0,0,0,0,0,0,0,0,0],
            output:[1,0,0,0,0,0,0,0,0,0,0,0]
        },
        {
            //      C C#D D#E F F#G G#A A#B
            input: [0,1,0,0,0,0,0,0,0,0,0,0],
            output:[0,0,0,0,0,1,0,0,0,0,0,0]
        },
        {
            //      C C#D D#E F F#G G#A A#B
            input: [0,0,0,0,0,1,0,0,0,0,0,0],
            output:[0,0,0,0,0,0,0,0,0,1,0,0]
        }
    ];

    trainer.trainAsync(trainingSet,{
        rate: 0.001,
        iterations: 50000,
        error: 0.05,
        shuffle: true,
        schedule: {
            every: 100,
            do: function(data) {
                NeuralComposer.log('Current Error: ' + data.error);
            }
        },
        cost: synaptic.Trainer.cost.CROSS_ENTROPY()
    }).then(results => console.log('done', results));

*/
});