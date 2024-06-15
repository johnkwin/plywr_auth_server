document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search');
    const userForm = document.getElementById('user-form');
    const userList = document.getElementById('user-list');

    // Search functionality
    searchInput.addEventListener('input', function() {
        const query = searchInput.value.toLowerCase();
        const userItems = document.querySelectorAll('.user-item');
        userItems.forEach(item => {
            const email = item.querySelector('.user-email').value.toLowerCase();
            if (email.includes(query)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });

    // Create new user functionality
    document.getElementById('create-user-button').addEventListener('click', function() {
        userForm.reset();
        document.getElementById('userId').value = '';
        userForm.scrollIntoView({ behavior: 'smooth' });
    });

    // Inline editing and save functionality
    userList.addEventListener('input', function(event) {
        const item = event.target.closest('.user-item');
        if (item) {
            item.querySelector('.save-button').style.display = 'inline-block';
        }
    });

    userList.addEventListener('click', function(event) {
        const target = event.target;

        if (target.classList.contains('admin-toggle-button')) {
            const isAdmin = target.getAttribute('data-isadmin') === 'true';
            target.setAttribute('data-isadmin', !isAdmin);
            target.textContent = !isAdmin ? 'On' : 'Off';
            target.style.background = !isAdmin ? '#28a745' : '#dc3545';
            target.closest('.user-item').querySelector('.save-button').style.display = 'inline-block';
        }

        if (target.classList.contains('save-button')) {
            const item = target.closest('.user-item');
            const userId = item.getAttribute('data-id');
            const email = item.querySelector('.user-email').value;
            const isAdmin = item.querySelector('.admin-toggle-button').getAttribute('data-isadmin') === 'true';
            const subscriptionStatus = item.querySelector('.subscription-select').value;

            fetch(`/admin/user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: userId,
                    email: email,
                    isAdmin: isAdmin,
                    subscriptionStatus: subscriptionStatus
                })
            }).then(response => {
                if (response.ok) {
                    target.style.display = 'none';
                } else {
                    alert('Error saving changes');
                }
            }).catch(error => {
                console.error('Error:', error);
            });
        }
    });
});
