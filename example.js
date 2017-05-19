/**
 * @file Example to show how to use the mi_band_1a module
 * @author David SALLE
 * @version 0.1.3
 */


// Add module
var mb1a = require('./index');
//var mb1a = require('mi-band-1a');

/*
// Unit tests functions
var uid = mb1a.compute_uid('testy');
console.log('uid => 0x' + uid.toString(16));

var hash_code = mb1a.compute_hash_code('testy');
console.log('hash_code => 0x' + hash_code.toString(16));

var normalized_alias = mb1a.normalize('testy');
console.log('normalized_alias => 0x' + normalized_alias.toString('hex'));

var crc8 = mb1a.compute_crc8(normalized_alias);
console.log('crc8 => 0x' + crc8.toString(16));

var user_info = mb1a.generate_user_info('c80f10768f85', 2, 25, 175, 70, 'testy', 0, 5, 0);
console.log('user_info => 0x' + user_info.toString('hex'));

var activity_data = Buffer([1,17,4,7,9,42,1,4,0,4,0,5,0,0,5,0,0,5,0,0,5,0,0,1,17,4,7,9,46,1,4,0,0,0]);
var steps = mb1a.analyse_activity_data(activity_data);
console.log('steps => ' + steps);
*/


// Unit tests object
console.log('====== mi-band-1a module unit tests ======');

//process.setMaxListeners(0);


// Allowed wrists devices
var allowed_devices = ['c80f10768f85', 'c80f10768f79', 'c80f10768f16'];

// RSSI threshold to discover only close devices
var rssi_threshold = -70;

// Locker to handle one device only at a time
var device_in_progress = false;
var discover_in_progress = true;


// Called when a BLE device is dicovered
function onDiscover(ble_device) {

    // Print device details
    discover_in_progress = false;
    console.log(' -> Discovered : ' + ble_device);
    console.log('   + id   : ' + ble_device._peripheral.id);
    console.log('   + rssi : ' + ble_device._peripheral.rssi);

    // Check if it is a mi band wrist and close enought
    for (var i=0; i<allowed_devices.length; i++) {
        if ( (allowed_devices[i] == ble_device._peripheral.id) && (ble_device._peripheral.rssi > rssi_threshold) && (device_in_progress == false) ) {

            console.log(' -> Mi-band-1a found : ' + ble_device._peripheral.id);
            device_in_progress = true;
            discover_in_progress = false;

            // What to do when we disconnect
            ble_device.on('disconnect', function() {
                console.log(' -> Disconnected ');
            });

            // Connect and setup with the Mi Band 1A
            ble_device.connectAndSetUp(function(error) {
                console.log(' -> Connected to ' + ble_device._peripheral.id);


                // Subscribe to some notifications (NOTIFICATION & ACTIVITY_DATA)
                ble_device.notifyActivityData(function() {
                    console.log(' -> Subscribe to ACTIVITY_DATA notifications');
                });

                // Initialize dialog
                ble_device.initialize(function() {
                    console.log(' -> Initialize communication');
                });

                // Read device informations
                ble_device.readDeviceInformations(function(error, data) {
                    console.log(' -> Read device informations');
                });

                // Authenticate
                ble_device.authenticate(ble_device._peripheral.id, 2, 25, 175, 70, 'testy', 0, 5, 0, function() {
                    console.log(' -> Authenticate');
                });

                // Read date/time
                ble_device.readDateTime(function(error, year, month, day, hour, minute, second) {
                    console.log(' -> Read date/time : ');
                    console.log('   + date/time : ' + day + '/' + month + '/' + year + ' at ' + hour + 'h' + minute + ':' + second);
                });

                // Read device informations
                ble_device.readDeviceInformations(function(error, data) {
                    console.log(' -> Read device informations');
                });

                // Read battery
                ble_device.readBattery(function(error, level, year, month, day, hour, minute, second, cycles, status) {
                    console.log(' -> Read battery : ');
                    console.log('   + battery level : ' + level + '%');
                    console.log('   + last time charged : ' + day + '/' + month + '/' + year + ' at ' + hour + 'h' + minute + ':' + second);
                    console.log('   + charge cycles : ' + cycles);
                    console.log('   + status (1=low, 2=charging, 3=full, 4=not charging): ' + status);
                });



                // Fetch activity data
                ble_device.fetchActivityData(function() {
                    console.log(' -> Fetch activity data');
                });

                // Read steps
                ble_device.readSteps(function(error, steps) {
                    console.log(' -> Read steps : ' + steps);

                    // Vibrate to indicate, data transfer is done
                    //ble_device.vibrate(function(error) {
                    //    console.log(' -> Vibrate ');
                    //});

                    // Disconnect the device
                    ble_device.tryDisconnect(function(error) {
                        console.log(' -> Disconnect...' + error);
                        device_in_progress = false;
                        discover_in_progress = true;
                        delete ble_device;
                    });
                });

            });

        }
    }
}


// Start to discover all BLE devices every 10s
mb1a.discoverAll(onDiscover);
setInterval(function() {
    mb1a.stopDiscoverAll(onDiscover);
    mb1a.discoverAll(onDiscover);
}, 10000);
