const input = process.argv[2];

if (!input) {
  console.error("usage: node inspect-raw.mjs <base64_tx>");
  process.exit(1);
}

const tx = Buffer.from(input, "base64");
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58(bytes) {
  if (bytes.length === 0) return "";

  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let index = 0; index < digits.length; index += 1) {
      const value = (digits[index] << 8) + carry;
      digits[index] = value % 58;
      carry = Math.floor(value / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let output = "";
  for (const byte of bytes) {
    if (byte === 0) output += alphabet[0];
    else break;
  }
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    output += alphabet[digits[index]];
  }
  return output;
}

let offset = 0;

function shortvec() {
  let result = 0;
  let shift = 0;

  while (true) {
    if (offset >= tx.length) throw new Error("shortvec read past end");
    const byte = tx[offset];
    offset += 1;
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return result;
    shift += 7;
  }
}

function read(length) {
  if (offset + length > tx.length) {
    throw new Error(`read(${length}) past end at offset ${offset}`);
  }
  const value = tx.subarray(offset, offset + length);
  offset += length;
  return value;
}

const signatureCount = shortvec();
const signatures = Array.from({ length: signatureCount }, () => read(64));

console.log("bytes:", tx.length);
console.log("signature count:", signatureCount);
signatures.forEach((signature, index) => {
  const signed = signature.some((byte) => byte !== 0);
  console.log(`signature[${index}]:`, signed ? base58(signature) : "MISSING");
});

const messageStart = offset;
const messagePrefix = tx[offset];
let version = "legacy";

if ((messagePrefix & 0x80) !== 0) {
  version = messagePrefix & 0x7f;
  offset += 1;
}

const header = {
  numRequiredSignatures: tx[offset],
  numReadonlySignedAccounts: tx[offset + 1],
  numReadonlyUnsignedAccounts: tx[offset + 2]
};
offset += 3;

const accountCount = shortvec();
const staticAccountKeys = Array.from({ length: accountCount }, () => read(32));
const recentBlockhash = read(32);
const instructionCount = shortvec();

console.log("message offset:", messageStart);
console.log("message version:", version);
console.log("header:", header);
console.log("static account keys:");

staticAccountKeys.forEach((key, index) => {
  const signer = index < header.numRequiredSignatures;
  let writable;
  if (signer) {
    writable = index < header.numRequiredSignatures - header.numReadonlySignedAccounts;
  } else {
    writable = index < staticAccountKeys.length - header.numReadonlyUnsignedAccounts;
  }
  console.log(`${index}: ${base58(key)} signer=${signer} writable=${writable}`);
});

console.log("recent blockhash:", base58(recentBlockhash));
console.log("compiled instructions:");

for (let index = 0; index < instructionCount; index += 1) {
  const programIdIndex = tx[offset];
  offset += 1;

  const accountIndexCount = shortvec();
  const accountIndexes = Array.from(read(accountIndexCount));
  const dataLength = shortvec();
  const data = read(dataLength);

  console.log(`instruction[${index}]:`);
  console.log("  program index:", programIdIndex);
  console.log("  program:", base58(staticAccountKeys[programIdIndex]));
  console.log("  accounts:", accountIndexes.join(","));
  console.log("  data length:", dataLength);
  console.log("  data base64:", data.toString("base64"));
}

if (version === 0) {
  const lookupCount = shortvec();
  console.log("address table lookups:", lookupCount);
  for (let index = 0; index < lookupCount; index += 1) {
    const table = read(32);
    const writableIndexes = Array.from(read(shortvec()));
    const readonlyIndexes = Array.from(read(shortvec()));
    console.log(`lookup[${index}]:`, base58(table), "writable=", writableIndexes, "readonly=", readonlyIndexes);
  }
}

console.log("remaining bytes:", tx.length - offset);
