document.addEventListener('DOMContentLoaded', function () {
    const userList = document.getElementById('userList');
    
    // Ensure event delegation for confirm changes button
    userList.addEventListener('click', function (event) {
        if (event.target.matches('.confirm-changes-button')) {
            const button = event.target;
            const listItem = button.closest('.user-list-item');
            const userId = listItem.dataset.userid;
            const isAdminButton = listItem.querySelector('.toggle-button');
            const subscriptionSelect = listItem.querySelector('select');
            const isAdmin = isAdminButton.classList.contains('active');
            const subscriptionStatus = subscriptionSelect.value;

            if (subscriptionStatus === 'delete') {
                fetch(`/admin/user/delete`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ id: userId })
                })
                .then(response => {
                    if (response.ok) {
                        listItem.remove(); // Remove the user from the list
                    } else {
                        console.error('Error deleting user:', response);
                    }
                })
                .catch(error => console.error('Error deleting user:', error));
            } else {
                fetch(`/admin/update-user/${userId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ isAdmin, subscriptionStatus })
                })
                .then(response => {
                    if (response.ok) {
                        button.style.display = 'none'; // Hide confirm button
                    } else {
                        console.error('Error updating user:', response);
                    }
                })
                .catch(error => console.error('Error updating user:', error));
            }
        }
    });
});
