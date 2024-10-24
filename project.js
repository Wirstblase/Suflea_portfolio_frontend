document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const projectType = urlParams.get('type');
    const projectTitle = urlParams.get('title');

    document.getElementById('project-type').textContent = projectType;
    document.getElementById('project-title').textContent = projectTitle;

    document.getElementById('back-button').addEventListener('click', () => {
        history.back();
    });
});