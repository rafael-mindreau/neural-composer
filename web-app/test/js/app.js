/**
 * Created by Rafael on 1/12/2016.
 */

'use strict';

var NeuralComposer = {
    init: function() {
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
    },

    /**
     * MIDI
     */

    midi: null,

    initMidi: function() {
        var inputs = NeuralComposer.midi.inputs.values();

        for (var input = inputs.next(); input && !input.done; input = inputs.next()) {
            input.value.onmidimessage = NeuralComposer.onMidiMessage;
        }
    },

    onMidiMessage: function(msg) {
        // { msg.data[2] > 0 } Some devices don't send stop-notes, but 0-velocity instead
        if (msg.data[0] === 144 && msg.data[2] > 0) NeuralComposer.playNote(msg.data[1]);
        if (msg.data[0] === 128 || msg.data[2] === 0) NeuralComposer.stopNote(msg.data[1]);
    },

    log: function(txt) {
        if (NeuralComposer.$console != null) {
            NeuralComposer.$console.append('<p>' + txt + '</p>');
            NeuralComposer.$console.get(0).scrollTop = NeuralComposer.$console.get(0).scrollHeight;
        }
    },

    playNote: function(note) {
        NeuralComposer.oscillators[note] = NeuralComposer.audioContext.createOscillator();
        NeuralComposer.oscillators[note].type = NeuralComposer.oscillatorType;
        NeuralComposer.oscillators[note].frequency.value = NeuralComposer.convertMidiToFrequency(note);
        NeuralComposer.oscillators[note].connect(NeuralComposer.mixer.gain);
        NeuralComposer.oscillators[note].start();

        if (NeuralComposer.trainingDataModel !== null) {
            $('#midiInputLedForTrainingData').addClass('active');
        }
    },

    stopNote: function(note) {
        NeuralComposer.oscillators[note].stop();
        NeuralComposer.oscillators[note].disconnect();

        if (NeuralComposer.trainingDataModel !== null) {
            $('#midiInputLedForTrainingData').removeClass('active');

            NeuralComposer.trainingDataAction(note);
        }
    },

    /**
     * App specific parameters
     */

    logParameterChanges: false,
    logEvents: true,

    /**
     * Training-data assembler
     */

    trainingData: {},
    trainingDataModel: null,

    trainingDataModels: {
        0: {
            baseNote: -1,

            setBaseNote: function(note) {
                NeuralComposer.log('Base-note selected: ' + note + '. Press take to set this as the base note for the training set.');

                // Forget previous events
                var btnTake = $('#btnTrainingDataTake').unbind();

                NeuralComposer.trainingDataModels[0].baseNote = note;

                // Set the task for TAKE
                btnTake.on('click', function(e) {
                    e.preventDefault();

                    NeuralComposer.log('Base note is: ' + note + '. Now you can play within the range of ' + note + ' and ' + (note+12) + '. Now select input note');

                    NeuralComposer.trainingDataAction = NeuralComposer.trainingDataModels[0].collectNote;
                    $(this).attr('disabled', true);
                });

                btnTake.attr('disabled', false);
            },

            collectNote: function(note) {
                // Not within range
                if (note > NeuralComposer.trainingDataModels[0].baseNote && note < NeuralComposer.trainingDataModels[0].baseNote + 12) {
                    NeuralComposer.log('collected note: ' + note);
                }
                else{
                    NeuralComposer.log('The note: ' + note + ' is not within expected range!');
                    return false;
                }

                // Forget previous events
                var btnTake = $('#btnTrainingDataTake').unbind();

                // This is regarded the base note
                NeuralComposer.trainingDataModels[0].baseNote = note;

                // Set the task for TAKE
                btnTake.on('click', function(e) {
                    e.preventDefault();

                    NeuralComposer.log('Note: ' + note + ' logged. Play the answer note. This note must be within the next 12 semi-tones!');
                    $(this).attr('disabled', true);
                });

                btnTake.attr('disabled', false);
            },

            default: (note) => NeuralComposer.trainingDataModels[0].setBaseNote(note)
        }
    },

    startTrainingData: function(e) {
        e.preventDefault();

        NeuralComposer.trainingDataModel = $('#dataModel').find('option:selected');

        // Disable Start button, enable stop button
        $('#btnTrainingDataStart').attr('disabled', true);
        $('#btnTrainingDataStop').attr('disabled', false);

        NeuralComposer.trainingDataAction = NeuralComposer.trainingDataModels[NeuralComposer.trainingDataModel.data('model-id')].default;

        NeuralComposer.log('Listening for training data. Start to play the first note');
    },

    stopTrainingData: function(e) {
        e.preventDefault();

        NeuralComposer.trainingDataModel = null;

        // Disable Start button, enable stop button
        $('#btnTrainingDataTake').unbind();
        $('#trainerDataSettings').find('.btn.taster').attr('disabled', true);
        $('#btnTrainingDataStart').attr('disabled', false);

        NeuralComposer.log('Training data collection ended');
    },

    /** App component behaviours
     *
     */

    makeKnob: function(component, task) {
        component.mousedown(function() {
            NeuralComposer.knobEvent.knob = $(this);

            NeuralComposer.knobEvent.event = setInterval(function() {
                var value = NeuralComposer.knobEvent.knob.val();
                var deg = (value * 3) - 150;

                task(value);

                NeuralComposer.logParameterChanges ? NeuralComposer.log('Type value: ' + value) : console.log() ;
                NeuralComposer.knobEvent.knob.parent().find('.rotor').css({'transform': 'rotate(' + deg + 'deg)'});
            }, 30);
        }).mouseup(function() {
            clearInterval(NeuralComposer.knobEvent.event);
        });
    },

    knobEvent: {
        knob: null,
        event: null
    },


    /**
     * WEB Audio
     */

    audioContext: new AudioContext(),

    convertMidiToFrequency: function(note) {
        return Math.pow(2, ((note - 69) / 12)) * NeuralComposer.oscillatorTune;
    },

    oscillatorType: 'sawtooth',
    oscillatorTune: 440,

    oscillators: {},

    mixer: {
        gain: null
    },

    changeOscTuning: function(value) {
        NeuralComposer.oscillatorTune = 440 + ((value - 50) / 2);
    },

    changeGain: function(value) {
        NeuralComposer.mixer.gain.gain.value = value / 100;
    },

    changeOscillatorType: function(value) {
        if (value < 25) {
            // Set Sine wave
            NeuralComposer.oscillatorType = 'sine';
            $('.oscillator .screen img').attr('src','img/sine.svg');
        }
        else if (value < 50) {
            NeuralComposer.oscillatorType = 'triangle';
            $('.oscillator .screen img').attr('src','img/triangle.svg');
        }
        else if (value < 75) {
            NeuralComposer.oscillatorType = 'sawtooth';
            $('.oscillator .screen img').attr('src','img/saw.svg');
        }
        else {
            NeuralComposer.oscillatorType = 'square';
            $('.oscillator .screen img').attr('src','img/square.svg');
        }
    }

};

$(document).ready(function() {
    /* Setup */
    NeuralComposer.init();

    // Init Osc Components
    NeuralComposer.makeKnob($('#oscType'), NeuralComposer.changeOscillatorType);
    NeuralComposer.makeKnob($('#oscDetune'), NeuralComposer.changeOscTuning);
    NeuralComposer.makeKnob($('#oscGain'), NeuralComposer.changeGain);

    // Init Data Assembler Module
    $('#btnTrainingDataStart').on('click', NeuralComposer.startTrainingData);
    $('#btnTrainingDataStop').on('click', NeuralComposer.stopTrainingData);

/*
    NeuralComposer.log('Starting Synaptic.js...');
    NeuralComposer.log('Creating MLP {12-24-24-12}...');

    var network = new synaptic.Architect.Perceptron(12,24,24,12);

    NeuralComposer.log('Creating trainer for Network...');
    var trainer = new synaptic.Trainer(network);

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