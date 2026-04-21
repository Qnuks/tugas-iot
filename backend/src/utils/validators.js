const { httpError } = require("./httpError");

function requireString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw httpError(400, `${fieldName} wajib berupa string dan tidak boleh kosong.`);
  }

  return value.trim();
}

function requireNumber(value, fieldName) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw httpError(400, `${fieldName} wajib berupa angka.`);
  }

  return parsed;
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw httpError(400, "Nilai numerik tidak valid.");
  }

  return parsed;
}

function requireBoolean(value, fieldName) {
  if (typeof value !== "boolean") {
    throw httpError(400, `${fieldName} wajib berupa boolean.`);
  }

  return value;
}

module.exports = {
  requireString,
  requireNumber,
  optionalNumber,
  requireBoolean
};
