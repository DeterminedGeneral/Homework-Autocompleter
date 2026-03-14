function dueDate(dueDateRaw) {
    let dueDateText = 'No due date';
    if (dueDateRaw && !isNaN(dueDateRaw.getTime())) {
        const now = new Date();
        const diffTime = dueDateRaw.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
                dueDateText = `Due ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} ago`;
            } else if (diffDays === 0) {
            dueDateText = 'Due today';
        } else if (diffDays === 1) {
            dueDateText = 'Due tomorrow';
        } else if (diffDays <= 7) {
            dueDateText = `Due in ${diffDays} days`;
        } else {
            dueDateText = `Due ${dueDateRaw.toLocaleDateString()}`;
        }
    }

    return dueDateText;
}

module.exports = dueDate;