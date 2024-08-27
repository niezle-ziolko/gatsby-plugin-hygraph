"use strict";

function specialField(type) {
  return typeof type.field !== 'undefined';
};
function specialUnion(type) {
  return type.type === 'Union';
};
function specialObject(type) {
  return type.type === 'Object';
};

module.exports = {
  specialField,
  specialUnion,
  specialObject
};