export function stripMarkdownFormatting(markdown) {
    // Remove bold and italic
    let plainText = markdown.replace(/(\*\*|__)(.*?)\1/g, "$2"); // bold
    plainText = plainText.replace(/(\*|_)(.*?)\1/g, "$2"); // italic

    // Remove links but keep the link text
    plainText = plainText.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");

    // Remove inline code
    plainText = plainText.replace(/`([^`]+)`/g, "$1");

    // Remove images but keep the alt text
    plainText = plainText.replace(/!\[([^\]]*)\]\([^\)]+\)/g, "$1");

    // Remove headers
    plainText = plainText.replace(/^#{1,6}\s*/gm, "");

    // Remove horizontal rules
    plainText = plainText.replace(/^-{3,}$/gm, "");

    // Remove blockquotes
    plainText = plainText.replace(/^\s*>+\s?/gm, "");

    // Remove lists
    plainText = plainText.replace(/^\s*([-+*]|\d+\.)\s+/gm, "");

    // Remove code blocks
    plainText = plainText.replace(/```[\s\S]*?```/g, "");

    // Remove HTML tags
    plainText = plainText.replace(/<\/?[^>]+(>|$)/g, "");

    // Remove escapes before square brackets that are not part of markdown links
    plainText = plainText.replace(/\\\[([^\]]+?)\\\]/g, "[$1]"); // handles escaped square brackets not part of links


    return plainText.trim();
}

export function _sectionRange(bodyContent, sectionHeadingText, headingIndex = 0) {
    console.debug(`_sectionRange`);
    const sectionRegex = /^#+\s*([^#\n\r]+)/gm;
    let indexes = Array.from(bodyContent.matchAll(sectionRegex));
    indexes = indexes.map(index => {
        let newIndex = index;
        newIndex[1] = stripMarkdownFormatting(newIndex[1]);
        return newIndex;
    });

    // Find the correct heading with index
    let occurrenceCount = 0;
    const sectionMatch = indexes.find(m => {
        if (m[1].trim() === sectionHeadingText.trim()) {
            if (occurrenceCount === headingIndex) {
                return true;
            }
            occurrenceCount++;
        }
        return false;
    });

    if (!sectionMatch) {
        console.error("Could not find section", sectionHeadingText, "that was looked up. This might be expected");
        return {startIndex: null, endIndex: null};
    } else {
        const level = sectionMatch[0].match(/^#+/)[0].length;
        const nextMatch = indexes.find(m => m.index > sectionMatch.index && m[0].match(/^#+/)[0].length <= level);
        const endIndex = nextMatch ? nextMatch.index : bodyContent.length;
        return {startIndex: sectionMatch.index + sectionMatch[0].length + 1, endIndex};
    }
}

