export default { 
  formRules: {
    userNameRules: [
      {
        required: true,
        message: 'Please input the UserName!',
      },
      {
        pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/,
        message: 'User name can only include letters, numbers, underscores, and Chinese characters!',
      },
      {
        min: 3,
        max: 50,
        message: 'User name must be between 3 and 50 characters!',
      },
    ],
    emailRules: [
      {
        required: true,
        type: 'email',
        message: 'Please input a valid Email!',
      },
      {
        max: 100,
        message: 'Email must be less than 100 characters!',
      },
    ],
    passwordRules: [
      {
        required: true,
        message: 'Please input your Password!',
      },
      {
        min: 8,
        max: 50,
        message: 'Password must be between 8 and 50 characters!',
      }
    ],
    introductionRules: [
      {
        max: 100,
        message: 'Introduction must be less than 100 characters!',
      },
      {
        pattern: /^[a-zA-Z0-9\s.,!?\"'；：，。！？、\-()（）\u4e00-\u9fa5]*$/,
        message: 'Introduction contains invalid characters!',
      },
    ],
    captchaCodeRules: [
      {
        required: true,
        message: 'Please input the Captcha Code!',
      },
      {
        pattern: /^\d{6}$/,
        message: 'Captcha Code must be 6 digits!',
      },
    ],
  }
};