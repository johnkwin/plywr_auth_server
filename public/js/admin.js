document.addEventListener('DOMContentLoaded', () => {
    const searchBar = document.getElementById('searchBar');
    const userForm = document.getElementById('new-user-form');
    const userListContainer = document.getElementById('user-list-container');

    searchBar.addEventListener('input', handleSearch);

    function handleSearch() {
        const query = searchBar.value.trim().toLowerCase();
        if (query) {
            fetch(`/admin/search-users?q=${encodeURIComponent(query)}`)
                .then(response => response.json())
                .then(users => {
                    renderUserList(users);
                    userForm.style.display = 'none'; // Hide new user form during search
                })
                .catch(err => console.error('Error searching users:', err));
        } else {
            userListContainer.innerHTML = ''; // Clear user list
            userForm.style.display = 'block'; // Show new user form when search is cleared
        }
    }

    function renderUserList(users) {
        userListContainer.innerHTML = ''; // Clear previous results

        users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';

            const emailInput = document.createElement('input');
            emailInput.type = 'email';
            emailInput.value = user.email;
            emailInput.dataset.originalValue = user.email;

            const adminButton = document.createElement('button');
            adminButton.textContent = user.isAdmin ? 'On' : 'Off';
            adminButton.dataset.originalValue = user.isAdmin;
            adminButton.classList.add(user.isAdmin ? 'admin-on' : 'admin-off');
            adminButton.addEventListener('click', () => {
                user.isAdmin = !user.isAdmin;
                adminButton.textContent = user.isAdmin ? 'On' : 'Off';
                adminButton.classList.toggle('admin-on');
                adminButton.classList.toggle('admin-off');
                showConfirmButton();
            });

            const subscriptionSelect = document.createElement('select');
            ['active', 'inactive'].forEach(status => {
                const option = document.createElement('option');
                option.value = status;
                option.textContent = status.charAt(0).toUpperCase() + status.slice(1);
                if (user.subscriptionStatus === status) {
                    option.selected = true;
                }
                subscriptionSelect.appendChild(option);
            });
            subscriptionSelect.dataset.originalValue = user.subscriptionStatus;

            emailInput.addEventListener('input', showConfirmButton);
            subscriptionSelect.addEventListener('change', showConfirmButton);

            const userControls = document.createElement('div');
            userControls.className = 'user-controls';
            userControls.appendChild(emailInput);
            userControls.appendChild(adminButton);
            userControls.appendChild(subscriptionSelect);

            const confirmButton = document.createElement('button');
            confirmButton.textContent = 'Confirm Changes';
            confirmButton.className = 'confirm-button hidden';
            confirmButton.addEventListener('click', () => {
                updateUser(user._id, {
                    email: emailInput.value,
                    isAdmin: user.isAdmin,
                    subscriptionStatus: subscriptionSelect.value
                });
                confirmButton.classList.add('hidden');
            });

            userItem.appendChild(userControls);
            userItem.appendChild(confirmButton);

            userListContainer.appendChild(userItem);
        });
    }

    function showConfirmButton() {
        const confirmButton = this.closest('.user-item').querySelector('.confirm-button');
        confirmButton.classList.remove('hidden');
    }

    function updateUser(id, data) {
        fetch(`/admin/user/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
            .then(response => response.json())
            .then(updatedUser => {
                console.log('User updated:', updatedUser);
            })
            .catch(err => console.error('Error updating user:', err));
    }
});
