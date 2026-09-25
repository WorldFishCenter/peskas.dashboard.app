/** Handlebars source; `resetLink` is filled in by MailService. */
export const resetPassword = `<html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 20px;
      background-color: #f4f4f4; } .container { max-width: 600px; margin: auto;
      background: white; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px
      rgba(0, 0, 0, 0.1); } .header { font-size: 24px; margin-bottom: 20px; }
      .content { font-size: 16px; line-height: 1.6; margin-bottom: 20px; }
      .action-button { display: inline-block; background-color: #007bff; color:
      white !important; padding: 10px 20px; text-decoration: none;
      border-radius: 5px; font-weight: bold; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">Reset Your Password</div>
      <div class="content">
        <p>Hello,</p>
        <p>We received a request to reset your password for your account.</p>
        <p>Here is your link:</p>
        <a href={{resetLink}}>Link</a>

        <p>If you did not request a password reset, please ignore this email.</p>
        <p>If you have any questions or need assistance, feel free to contact
          our support team.</p>
      </div>
    </div>
  </body>
</html>`;
