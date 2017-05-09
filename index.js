/**
 * @file Source code of the mi_band_1a module
 * @author David SALLE
 * @version 0.1.0
 *
 * https://github.com/sandeepmistry/noble-device
 */


// External module use by MiBand1A module
var NobleDevice = require('noble-device');
var events = require('events');



// Mi Band 1A UUID
var SERVICE_UUID =          '0000fee0-0000-1000-8000-00805f9b34fb'
var DEVICE_INFO_UUID =      '0000ff01-0000-1000-8000-00805f9b34fb';
var DEVICE_NAME_UUID =      '0000ff02-0000-1000-8000-00805f9b34fb';
var NOTIFICATION_UUID =     '0000ff03-0000-1000-8000-00805f9b34fb';
var USER_INFO_UUID =        '0000ff04-0000-1000-8000-00805f9b34fb';
var CONTROL_POINT_UUID =    '0000ff05-0000-1000-8000-00805f9b34fb';
var REALTIME_STEPS_UUID =   '0000ff06-0000-1000-8000-00805f9b34fb';
var ACTIVITY_DATA_UUID =    '0000ff07-0000-1000-8000-00805f9b34fb';
var FIRMWARE_DATA_UUID =    '0000ff08-0000-1000-8000-00805f9b34fb';
var LE_PARAMS_UUID =        '0000ff09-0000-1000-8000-00805f9b34fb';
var DATE_TIME_UUID =        '0000ff0a-0000-1000-8000-00805f9b34fb';
var STATISTICS_UUID =       '0000ff0b-0000-1000-8000-00805f9b34fb';
var BATTERY_UUID =          '0000ff0c-0000-1000-8000-00805f9b34fb';
var TEST_UUID =             '0000ff0d-0000-1000-8000-00805f9b34fb';
var SENSOR_UUID =           '0000ff0e-0000-1000-8000-00805f9b34fb';

// Global variables
var ack_messages = [];
var activity_data = [];
var data_block_datak_counter = 0;
var keep_data = false;
var myEmitter = new events.EventEmitter();



// Where all start...
var MiBand1A = function(peripheral) {
    // Call noble super constructor
	NobleDevice.call(this, peripheral);
}


// Inherit noble device
NobleDevice.Util.inherits(MiBand1A, NobleDevice);

// you can mixin other existing service classes here too,
// noble device provides battery and device information,
// add the ones your device provides
//NobleDevice.Util.mixin(MiBand1A, NobleDevice.BatteryService);
//NobleDevice.Util.mixin(MiBand1A, NobleDevice.DeviceInformationService);


/**
 * Disconnect
 * @param {function} Callback function when it is done
 * @return nothing
 */
MiBand1A.prototype.tryDisconnect = function(callbackWhenDone) {
    this._peripheral.disconnect( function(error) {
		callbackWhenDone(error);
	}.bind(this));
};


/**
 * Initialize dialog with MiBand1A
 * @param {function} Callback function to handle data
 * @return nothing
 */
MiBand1A.prototype.initialize = function(callbackWhenDone) {
    var data = new Buffer([0x01, 0x00]);
    this._peripheral.writeHandle('0x0017', data, false, callbackWhenDone);
    this._peripheral.writeHandle('0x0021', data, false, callbackWhenDone);
};


/**
 * Read device informations
 * @param {function} Callback function to handle data
 * @return nothing
 */
MiBand1A.prototype.readDeviceInformations = function(callbackWhenDone) {
	this._peripheral.readHandle('0x0012', function(error, data) {
		/*for (var i=0; i<data.length; i++) {
			console.log( '   + 0x' + data.readUInt8(i).toString(16) );
		}*/
		callbackWhenDone(error, data);
	}.bind(this));
};


/**
 * Authenticate against the Mi Band 1A
 * @param {string} btAdress (eg: "c80f10768f85")
 * @param {integer} gender (0=woman, 1=man, 2=other)
 * @param {integer} age (eg: 20)
 * @param {integer} height in cm (eg: 175)
 * @param {integer} weight in kg (eg: 75)
 * @param {string} alias (eg: "jbegood")
 * @param {integer} type ??? where we wear it ??? (left hand=0, right hand=1)
 * @param {integer} feature ??? (MiBand_1A=5, MiBand_1S=4)
 * @param {integer} appearance ??? color ??? (noire=0)
 * @param {function} Callback function when it is done
 */
MiBand1A.prototype.authenticate = function(btAdress, gender, age, height, weight, alias, type, feature, appearance, callbackWhenDone) {
	var user_info = generate_user_info(btAdress, gender, age, height, weight, alias, type, feature, appearance);
    this._peripheral.writeHandle('0x0019', user_info, false, callbackWhenDone);
};


/**
 * Read date/time
 * @param {function} Callback function to handle data
 * @return nothing
 */
MiBand1A.prototype.readDateTime = function(callbackWhenDone) {
	this._peripheral.readHandle('0x0028', function(error, data) {
		/*for (var i=0; i<data.length; i++) {
			console.log( '   + 0x' + data.readUInt8(i).toString(16) );
		}*/
		var year = data[1] + 2000;
		var month = data[2] + 1;
		var day = data[3];
		var hour = data[4];
		var minute = data[5];
		var second = data[6];
		callbackWhenDone(error, year, month, day, hour, minute, second);
	}.bind(this));
};


/**
 * Read battery informations
 * @param {function} Callback function to handle data
 * @return nothing
 *
 * Level in%: byte[0]
 * Last charge date:
 *   Year:        byte[1] + 2000
 *   Month:       byte[2]
 *   Day / date:  byte[3]
 *   Hour (0-24): byte[4]
 *   Minute:      byte[5]
 *   Second:      byte[6]
 * Number of charges:   0xffff & (0xff & byte[7] | (0xff & byte[8]) << 8)
 * Battery status:    byte[9]
 *   1 = Battery low
 *   2 = Battery charging
 *   3 = Battery full (charging)
 *   4 = Not charging
 */
MiBand1A.prototype.readBattery = function(callbackWhenDone) {
	this._peripheral.readHandle('0x002c', function(error, data) {
		/*for (var i=0; i<data.length; i++) {
			console.log( '   + 0x' + data.readUInt8(i).toString(16) );
		}*/
		if (data.length == 10) {
			var level = data[0];
			var year = data[1] + 2000;
			var month = data[2] + 1;
			var day = data[3];
			var hour = data[4];
			var minute = data[5];
			var second = data[6];
			var cycles = 0xffff & (0xff & data[7] | (0xff & data[8]) << 8);
			var status = data[9];
		}

		callbackWhenDone(error, level, year, month, day, hour, minute, second, cycles, status);
	}.bind(this));
};


/**
 * Fetch activity data
 * @param {function} Callback function to handle data
 * @return nothing
 */
MiBand1A.prototype.fetchActivityData = function(callbackWhenDone) {
	myEmitter.on('notificationReady', () => {
		// Still don't know what it means
		var magic = new Buffer([0x01, 0x00]);
	    this._peripheral.writeHandle('0x001e', magic, false, callbackWhenDone);

		// Ask to receive activity data as notifications in ACTIVITY_DATA
	    var data = new Buffer([0x06]);
	    this._peripheral.writeHandle('0x001b', data, false, callbackWhenDone);

		callbackWhenDone();
	}.bind(this));
};


/**
 * Subscribe to ACTIVITY_DATA notification
 * @param {function} Callback function when it is done
 * @return nothing
 */
MiBand1A.prototype.notifyActivityData = function(callbackWhenDone) {
	this.onActivityDataChangeBinded = this.onActivityDataChange.bind(this);
	this.notifyCharacteristic('fee0', 'ff07', true, this.onActivityDataChangeBinded, function() {
		myEmitter.emit('notificationReady');
		callbackWhenDone();
	});
};


/**
 * Unsubscribe to ACTIVITY_DATA notification
 * @param {function} Callback function when it is done
 * @return nothing
 */
MiBand1A.prototype.unnotifyActivityData = function(callbackWhenDone) {
	this.notifyCharacteristic('fee0', 'ff07', false, this.onActivityDataChangeBinded, callbackWhenDone);
};


/**
 * Handle activity data received from ACTIVITY_DATA notification
 * @param {function} Callback function to handle data
 * @return nothing
 */
MiBand1A.prototype.onActivityDataChange = function(data) {
	// Push received data in the big activity data
	for (var i=0; i<data.length; i++) {
		activity_data.push( data.readUInt8(i) );
		//process.stdout.write( ' 0x' + data.readUInt8(i).toString(16) );
	}
	//console.log('');

	// Is it an header ???
	// FIXME: change year in the third condition
	if ( (data.length == 11) && (data.readUInt8(0) == 0x01) && (data.readUInt8(1) == 0x11) ) {
		data_block_datak_counter++;
		//console.log('   + New header_block_datak : ' + data_block_datak_counter);

		// How many bytes to read ?
		var bytes_transferred = ((data.readUInt8(10) * 256) + data.readUInt8(9)) * 3 ;
		//console.log('   + bytes_transferred => ' + bytes_transferred);

		// Prepare the ack message
		var ack_message = new Buffer(9);
		ack_message.writeUInt8(0x0a, 0);                    // ACK command
		ack_message.writeUInt8( data.readUInt8(1), 1);      // Date
		ack_message.writeUInt8( data.readUInt8(2), 2);
		ack_message.writeUInt8( data.readUInt8(3), 3);
		ack_message.writeUInt8( data.readUInt8(4), 4);
		ack_message.writeUInt8( data.readUInt8(5), 5);
		ack_message.writeUInt8( data.readUInt8(6), 6);

		if (keep_data == true) {
			ack_message.writeUInt8( ~bytes_transferred & 0xff, 7);              // Checksum formula if we do not want to delete data on wrist
			ack_message.writeUInt8( (0xff & (~bytes_transferred >> 8)), 8);
		}
		else {
			ack_message.writeUInt8( bytes_transferred & 0xff, 7);              // Checksum if we want to delete data on wrist
			ack_message.writeUInt8( (0xff & (bytes_transferred >> 8)), 8);
		}

		//console.log('   + ack to send => ' + ack_to_send.toString('hex'));
		// Push ack message in a big array to send all after all bytes are received
		if (data_block_datak_counter > 1) {
			ack_messages.push(ack_message);
		}

		// If it is the last header (that is to say no more data), we send ack messages to delete or not the data inside the Mi Band 1A
		if (bytes_transferred == 0) {
			// Emit event to analyse and decode activity data
			myEmitter.emit('activityDataTransfered');
		}
	}
	else {
		//console.log('   + New data_block_datak');
	}

	// Print details
	for (var i=0; i<data.length; i++) {
		//console.log( '   + 0x' + data.readUInt8(i).toString(16) );
		//process.stdout.write( ' 0x' + data.readUInt8(i).toString(16) );
	}
	//console.log('');
};


/**
 * Read steps (contains in activity data global variable)
 * @param {function} Callback function to handle data
 * @return nothing
 */
MiBand1A.prototype.readSteps = function(callbackWhenDone) {
	// This function is called only when all activity data are transfered
	myEmitter.on('activityDataTransfered', () => {
		// Send all ack messages to Mi Band 1A (to delete or not the data inside)
		for (var j=0; j<ack_messages.length; j++) {
			this._peripheral.writeHandle('0x001b', ack_messages[j], false, function(error) {
				//console.log(' -> write CONTROL_POINT ff05, ack data transfer (' + ack_messages[j].toString('hex') + ') : ' + error);
			});
		}

		// Analyse and decode activity data to read steps
		//console.log(' -> Start analysing and decoding activity data');
		var steps = analyse_activity_data(activity_data);
		var error = 0;

		// Callback when it is done
		callbackWhenDone(error, steps);
	}.bind(this));
};


/******************************************************************************/
/******************************************************************************/
/******************************************************************************/


/**
 * Compute uid number from alias
 * @param {string} alias
 * @return {integer} uid
 */
 function compute_uid(alias) {
     // Try to convert string to integer
     var uid = parseInt(alias, 10);

     // If convertion fails, compute the Java's hashCode() of the string
     if ( isNaN(uid) == true ) {
         uid = compute_hash_code(alias);
     }

     return uid;
 }


/**
 * Clone of the Java hashCode() function
 * @param {string} some_string
 * @return {integer} hash
 */
 function compute_hash_code(some_string) {
    var hash = 0;

    if (some_string.length == 0) return hash;

    for (i = 0; i < some_string.length; i++) {
        char = some_string.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    return hash;
}


/**
 * Normalize alias = max length of 8 char + fill empty byte with 0x00
 * @param {string} alias
 * @return {Buffer} normalized_alias
 */
function normalize(alias) {
    // Préparation de la variable résultat
    var alias_normalise = new Buffer(8);

    // Calcul de la limite de la chaine
    var limite = alias.length;
    if (limite > 8) {
        limite = 8;
    }
    // Remplissage par défaut avec des caractères '0'
    for (var i=0; i<alias_normalise.length; i++) {
        alias_normalise.writeUInt8(0x00, i);
    }

    // Copie de l'alias à la fin de la chaine
    for (var i=0; i<limite; i++) {
        alias_normalise.writeUInt8(alias.charCodeAt(i), i);
    }

    // On retourne le tout
    return alias_normalise;
}


/**
 * Compute CRC8 of a sequence of bytes
 * @param {Buffer} sequence
 * @return {byte} crc8
 */
function compute_crc8(sequence) {
    var len = sequence.length;
    var i = 0;
    var crc8 = 0x00;

    while (len-- > 0) {
        var extract = sequence[i++];
        for (var tempI = 8; tempI != 0; tempI--) {
            var sum = ((crc8 & 0xff) ^ (extract & 0xff));
            sum = ((sum & 0xff) & 0x01);
            crc8 = ((crc8 & 0xff) >>> 1);
            if (sum != 0) {
                crc8 = ((crc8 & 0xff) ^ 0x8c);
            }
            extract = ((extract & 0xff) >>> 1);
        }
    }
    return (crc8 & 0xff);
}


/**
 * Generate a 20 bytes sequence from user informations to authenticate against the Mi Band 1A
 * @param {string} btAdress Chaine de caractères représentant l'adresse Bluetooth du bracelet (ex: "c80f10768f85")
 * @param {integer} gender Sexe de la personne (0=femme, 1=homme, 2=autre)
 * @param {integer} age Age de la personne (ex: 20)
 * @param {integer} height Hauteur de la personne en cm (ex: 175)
 * @param {integer} weight Poids de la personne en kg (ex: 75)
 * @param {string} alias Chaine de caractères (ex: "jbegood")
 * @param {integer} type ??? Peut-être où est porté le bracelet (gauche=0, droite=1)
 * @param {integer} feature ??? (MiBand_1A=5, MiBand_1S=4)
 * @param {integer} appearance ??? Couleur ??? (noire=0)
 * @return {Buffer} Une séquence d'octet à envoyer sur UUID 0xff05 pour s'authentifier sur le bracelet
 * @see https://github.com/Freeyourgadget/Gadgetbridge/blob/e392fbfd800dc326aee2ac49e122a41ab223ab05/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/devices/miband/UserInfo.java
 * @see https://github.com/betomaluje/Mi-Band/blob/6542e34ec5f5b2190262558898ab72810f1b880f/MiBand/app/src/main/java/com/betomaluje/miband/model/UserInfo.java
 */
function generate_user_info(btAdress, gender, age, height, weight, alias, type, feature, appearance) {

    // Suite d'octets finale à envoyer au bracelet
    var user_info = new Buffer(20);
    for (var i=0; i<user_info.length; i++)
    {
        user_info.writeUInt8(0x00, i);
    }

    // Préparation de la zone uid
    var uid = compute_uid(alias);
    user_info.writeUInt8( (uid >> 0) & 0x000000ff, 0);  // user ID
    user_info.writeUInt8( (uid >> 8) & 0x000000ff, 1);  // user ID
    user_info.writeUInt8( (uid >> 16) & 0x000000ff, 2);  // user ID
    user_info.writeUInt8( (uid >> 24) & 0x000000ff, 3);  // user ID

    // Préparation de la zone caractéristiques
    user_info.writeUInt8(gender, 4);  // gender (0:female, 1:male)
    user_info.writeUInt8(age, 5);  // age
    user_info.writeUInt8(height, 6);  // height
    user_info.writeUInt8(weight, 7);  // weight
    user_info.writeUInt8(type, 8);  // type
    user_info.writeUInt8(feature, 9);  // feature
    user_info.writeUInt8(appearance, 10);  // appearance

    // Préparation de la zone de l'alias
    var alias_normalise = normalize(alias);
    for (var i=0; i<alias_normalise.length; i++) {
        user_info.writeUInt8(alias_normalise.readUInt8(i), 11+i);
    }

    // Préparation du tampon temporaire servant à calculer le CRC8
    var temp_buffer = new Buffer(19);
    for (var i=0; i<temp_buffer.length; i++) {
        temp_buffer.writeUInt8(user_info.readUInt8(i), i);
    }

    // Calcul du CRC8
    var crc8_alias = compute_crc8(temp_buffer);
    //console.log('CRC8 => ' + crc8_alias.toString(16) );

    // Découpage du dernier octet de l'adresse MAC du bracelet
    var btAdress_end = parseInt(btAdress, 16) & 0x000000ff;
    //console.log('BT end => ' + btAdress_end.toString(16) );

    var magic_crc = (crc8_alias ^ btAdress_end) & 0x000000ff;
    //console.log('magic => ' + magic_crc.toString(16) );

    // Ajout du CRC magic à la fin de la séquence
    user_info.writeUInt8(magic_crc, 19);

    // On retourne le tout
    return user_info;
}


/**
 * Analyse and decode steps and sleep activities
 * @param {Buffer} tab Séquence d'octets brutes contenant toutes les données d'activité reçues
 * @return {integer} Le nombre de pas effectués
 */
function analyse_activity_data(tab) {
    // Analyse
    var curseur_global = 0;
    var curseur_local = 0;
    var prochain_entete = 0;
    var temp_header_data = null;
    var temp_block_data = null;
    var total = 0;
    var resultat = [-1, -1];
    var nb_pas = 0;
    var compteur_minutes = 0;
    var fin_analyse = false;

    //console.log("=== Statistiques ===");
    //console.log("  + taille (octets) : " + tab.length);

    while (fin_analyse == false) {
        // Analyse de l'en-tête
        temp_header_data = tab.slice(curseur_global, curseur_global+11);
        resultat = analyse_header_data(temp_header_data);
        curseur_global += 11;
        data_to_read = resultat[0];            // data_to_read
        data_until_next_header = resultat[1];  // data_until_next_header

        if (data_until_next_header == 0) {
            fin_analyse = true;
        }

        // Analyse du block_data de données
        curseur_local = 0;
        while (curseur_local < data_until_next_header) {
            // Découpage d'un bloc de 3 octets
            temp_block_data = tab.slice(curseur_global, curseur_global+3);
            curseur_local += 3;
            curseur_global += 3;

            // Analyse du bloc
            nb_pas += analyse_block_data(temp_block_data);
        }
        //console.log("  + curseur_global : " + curseur_global);
    }

    // On retourne le résultat
    return nb_pas;
}


/**
 * Analyse and decode an header block of activity data
 * @param {Buffer} header_data to analyse and decode
 * @return {Array} number of data_to_read and data_until_next_header
 */
function analyse_header_data(header_data) {
    //console.log("=== HEADER DATA BLOCK ===");
    //console.log('  + header_data => ' + header_data.toString('hex'));

	// FIXME: change year in the third condition
	if ( (header_data.length == 11) && (header_data[0] == 0x01) && (header_data[1] == 0x11) ) {
        // On décortique
        var data_type = header_data[0];
        var date_annee = header_data[1] + 2000;
        var date_mois = header_data[2] + 1;
        var date_jour = header_data[3];
        var date_heures = header_data[4];
        var date_minutes = header_data[5];
        var date_secondes = header_data[6];
        var data_to_read = header_data[7] + (256 * header_data[8]);
        var data_until_next_header = header_data[9] + (256 * header_data[10]);

        if (data_type == 1) {
            data_to_read *= 3;
            data_until_next_header *= 3;
        }

        // Création d'une date
        var date_debut = new Date();
        date_debut.setFullYear(date_annee);
        date_debut.setMonth(date_mois);
        date_debut.setDate(date_jour);
        date_debut.setHours(date_heures);
        date_debut.setMinutes(date_minutes);
        date_debut.setSeconds(date_secondes);

        // Affichage
        //console.log("  + data_type : " + data_type);
        //console.log("  + date : " + date_jour + "/" + date_mois + "/" + date_annee + " à " + date_heures + "h" + date_minutes + ":" + date_secondes);
        //console.log("  + data_to_read (octets): " + data_to_read);
        //console.log("  + data_until_next_header (octets): " + data_until_next_header);

        // On retourne les résultats
        return [data_to_read, data_until_next_header];
    }
    else {
        //console.log("Pas le bon nombre d'octets pour le block_data d'en-tête");
        return [-1, -1];
    }
}


/**
 * Analyse and decode a block of activity data
 * @param {Buffer} block_data to analyse and decode
 * @return {integer} number of steps
 */
function analyse_block_data(block_data) {
    //console.log("=== ACTIVITY DATA BLOCK ===");
    //console.log('  + block_data => ' + block_data.toString('hex'));
    var nb_pas = 0;
    var compteur_minutes = 0;
    if (block_data.length == 3) {
        if (block_data[2] > 0) {
            //console.log("  + category=" + block_data[0] + ", intensity=" + block_data[1] + ", steps=" + block_data[2] + ", minutes=" + compteur_minutes + ", heures=" + compteur_minutes/24);
        }
        nb_pas += block_data[2];
        //compteur_minutes += 1;
    }
    else {
        //console.log("Pas le bon nombre d'octets pour le block_data de données : " + block_data.length);
    }
    return nb_pas;
}

// Export function of the module
exports.compute_uid = compute_uid;
exports.compute_hash_code = compute_hash_code;
exports.normalize = normalize;
exports.compute_crc8 = compute_crc8;
exports.generate_user_info = generate_user_info;
exports.analyse_activity_data = analyse_activity_data;
exports.analyse_header_data = analyse_header_data;
exports.analyse_block_data = analyse_block_data;
module.exports = MiBand1A;
