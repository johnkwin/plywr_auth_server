function confirmChanges(button) {
    const userId = button.dataset.userid;
    const userItem = button.closest('.user-list-item');
    const isAdmin = userItem.querySelector('.toggle-button').classList.contains('active');
    const subscriptionStatus = userItem.querySelector('select').value;
    const email = userItem.querySelector('input[type="text"]').value;

    fetch(`/admin/update-user/${userId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, isAdmin, subscriptionStatus })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('User updated:', data.user); // Debugging
            userItem.classList.remove('changed');
            button.style.display = 'none';
        } else {
            console.error('Error updating user:', data.message);
        }
    })
    .catch(error => {
        console.error('Error updating user:', error);
    });
}
