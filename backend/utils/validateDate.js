
export const validateDate = ({ begin_date, end_date }) => {
    const errors = [];

    const begin = new Date(begin_date);
    const end = new Date(end_date);
    const now = new Date();

    if (isNaN(begin.getTime()) || isNaN(end.getTime())) {
        errors.push("Date format is invalid.");
    } else {
        if (begin >= end) errors.push("Begin date must be before End date.");

        if (end < now) errors.push("End date cannot be in the past!");
    }

    // return message and invalid flag
    if (errors.length > 0) {
        return { valid: false, message: errors.join(" ") };
    }

    return { valid: true, begin, end };
};