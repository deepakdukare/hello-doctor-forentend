/**
 * Removes standard salutations from a name for display purposes.
 * Salutations like "Master", "Miss", "Baby", etc. are removed only from the start of the string.
 * @param {string} name - The name to format
 * @returns {string} - The name without the salutation
 */
export const removeSalutation = (name) => {
    if (!name) return "";

    const salutations = [
        "Master ", "Miss ", "Baby of ", "Baby ", "Mr. ", "Mrs. ", "Ms. ", "Dr. ",
        "MASTER ", "MISS ", "BABY OF ", "BABY ", "MR. ", "MRS. ", "MS. ", "DR. ",
        "Baby Of ", "Baby of ", "B/O ", "b/o "
    ];

    // Sort by length descending to match longest salutations first (e.g. "Baby of" before "Baby")
    const sortedSalutations = [...salutations].sort((a, b) => b.length - a.length);

    let formattedName = name.trim();
    for (const salutation of sortedSalutations) {
        if (formattedName.startsWith(salutation)) {
            formattedName = formattedName.substring(salutation.length);
            break;
        }
    }

    return formattedName.trim();
};
