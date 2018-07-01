/* Cryptology used Forge.js lib to encrypt/decrypt by symmetric or asymmetric algorithms */
"use strict";

// Create the encryption object for asymmetric RSA algorithm.
var rsa = new JSEncrypt();

// define the characters to pick from
var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz*&-%/!?*+=()";

// create a key for symmetric encryption
// pass in the desired length of your key
function generateKey(keyLength) {
    var randomstring = '';

    for (var i = 0; i < keyLength; i++) {
        var rnum = Math.floor(Math.random() * chars.length);
        randomstring += chars.substring(rnum, rnum + 1);
    }
    return randomstring;
}

// create the pair public and private key for asymmetric encryption
var generateKeyPair = function () {
    var crypt = new JSEncrypt({ default_key_size: 1024 });
    crypt.getKey();

    return {
        privateKey: crypt.getPrivateKey(),
        publicKey: crypt.getPublicKey()
    }
};

// hasing text by sha-512 algorithm
String.prototype.getHash = function () {
    return CryptoJS.SHA512(this).toString();
}

// symmetric 3DES encryption
String.prototype.symEncrypt = function (pass) {
    return CryptoJS.TripleDES.encrypt(this, pass).toString();
}

// symmetric 3DES decryption
String.prototype.symDecrypt = function (pass) {
    var bytes = CryptoJS.TripleDES.decrypt(this, pass);
    return bytes.toString(CryptoJS.enc.Utf8);
}

// asymmetric RSA encryption
String.prototype.asymEncrypt = function (publicKey) {
    rsa.setPublicKey(publicKey);
    return rsa.encrypt(this);
}

// asymmetric RSA decryption
String.prototype.asymDecrypt = function (privateKey) {
    rsa.setPrivateKey(privateKey); // Set the private.
    return rsa.decrypt(this);
}

function getCipherKeys() {
    var keys = localStorage.cipherKeys; // read keys json 
    if (keys == null) {
        keys = generateKeyPair();

        // store keys as json in localStorage
        localStorage.cipherKeys = JSON.stringify(keys);
        return keys;
    }

    return JSON.parse(keys);
}