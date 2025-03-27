const { ethers } = require('ethers');

const hexMessage = '566f74657220636f756e7420696e6372656d656e746564000000000000000000';
if (!hexMessage) {
    console.error('Hex message is undefined or empty');
    process.exit(1);
}  

const decodedMessage = ethers.toUtf8String('0x' + hexMessage.replace(/00+$/, ''));

console.log(decodedMessage); // Output: Proof struct created
