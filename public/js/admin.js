document.addEventListener('DOMContentLoaded', function () {
    // Attach event listeners to edit buttons
    document.querySelectorAll('.edit-button').forEach(button => {
        button.addEventListener('click', function () {
            const id = this.dataset.id;
            const email = this.dataset.email;
            const isAdmin = this.dataset.isadmin === 'true';
            const subscriptionStatus = this.dataset.subscriptionstatus;

            document.getElementById('userId').value = id;
            document.getElementById('email').value = email;
            document.getElementById('isAdmin').checked = isAdmin;
            document.getElementById('subscriptionStatus').value = subscriptionStatus;
        });
    });
});
