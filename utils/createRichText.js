const richTextTypes = require('@graphcms/rich-text-types');


function iframe(node) {
  return richTextTypes.isElement(node) && node.type === 'iframe';
};
function embed(node) {
  return richTextTypes.isElement(node) && node.type === 'embed';
};
function image(node) {
  return richTextTypes.isElement(node) && node.type === 'image';
};
function reduceSpaces(text) {
  return text.replace(/[\r\t\f\v \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/g, " ");
};

function validTextString(text) {
  if (!text)
    return undefined;
    
  const despaced = reduceSpaces(text);
    
  if (despaced.length === 1 && despaced.startsWith(" "))
    return undefined;
  
  if (despaced.length > 0) {
    return despaced.replace(/&nbsp;/g, '\u00a0').replace(/-/g, '\u2011');
  };

  return undefined;
};

const keepEmpty = {
  table_header_cell: true,
  table_cell: true,
  iframe: true
};

function cleanupElementNode(elementNode) {
  const { children, ...rest } = elementNode;
  const newChildren = [];
  children.forEach(child => {
    if (richTextTypes.isText(child)) {
      const shrunk = reduceSpaces(child.text);

      if (shrunk === " ") {
        if (newChildren.length > 0) {
          newChildren.push({ ...child, text: shrunk });
        };
      } else {
        const cleaned = validTextString(child.text);

        if (cleaned) {
          newChildren.push({ ...child, text: cleaned });
        };
      };
    } else if (richTextTypes.isElement(child)) {
      const newChild = cleanupElementNode(child);

      if (newChild) {
        newChildren.push(newChild);
      } else if (keepEmpty[child.type]) {
        newChildren.push({ type: child.type, children: [] });
      };
    };
  });

  if (newChildren.length === 1) {
    const child = newChildren[0];

    if ((0, richTextTypes.isText)(child) && child.text === " ") {
      newChildren.pop();
    };
  };

  if (embed(elementNode) || image(elementNode) || iframe(elementNode)) {
    return { ...rest, children: newChildren };
  };
  
  if (newChildren.length) {
    return { ...rest, children: newChildren };
  };
  
  return undefined;
};

function cleanupRichTextContent(content) {
  const elements = Array.isArray(content) ? content : content.children;
  const newElements = [];
  
  elements.forEach(element => {
    const cleanedElement = cleanupElementNode(element);

    if (cleanedElement) {
      newElements.push(cleanedElement);
    };
  });

  if (newElements.length) {
    return newElements;
  };

  return undefined;
};

module.exports = {
  cleanupRichTextContent: cleanupRichTextContent
};