using System.ComponentModel.DataAnnotations;
using FluentValidation;
using FluentValidation.Attributes;
using SmartStore.Core.Domain.Customers;
using SmartStore.Web.Framework;
using SmartStore.Web.Framework.Modelling;

namespace SmartStore.Web.Models.Common
{
    [Validator(typeof(ChangeAddressValidator))]
    public partial class ChangeAddressModel : ModelBase
    {
        public string ChangeAddressFirstName { get; set; }
        public string ChangeAddressTitle{ get; set; }

        [SmartResourceDisplayName("ChangeAddressLastName")]
        public string ChangeAddressLastName { get; set; }

        public string ChangeAddressAddressType { get; set; }

        [SmartResourceDisplayName("ChangeAddressAddress1")]
        public string ChangeAddressAddress1 { get; set; }

        [SmartResourceDisplayName("ChangeAddressZipPostalcode")]
        public string ChangeAddressZipPostalCode { get; set; }

        [SmartResourceDisplayName("ChangeAddressCity")]
        public string ChangeAddressCity { get; set; }

        [SmartResourceDisplayName("ChangeAddressCountry")]
        public string ChangeAddressCountry { get; set; }


        [SmartResourceDisplayName("ChangeAddress.Email")]
        [DataType(DataType.EmailAddress)]
        public string ChangeAddressEmail { get; set; }
        [SmartResourceDisplayName("ChangeAddressPhoneNumber")]
        public string ChangeAddressPhoneNumber { get; set; }

        public bool ChangeAddressSuccessfullySent { get; set; }
        public string ChangeAddressResult { get; set; }

        public bool ChangeAddressDisplayCaptcha { get; set; }

        public string ChangeAddressMetaTitle { get; set; }
        public string ChangeAddressMetaDescription { get; set; }
        public string ChangeAddressMetaKeywords { get; set; }
    }

    public class ChangeAddressValidator : AbstractValidator<ChangeAddressModel>
    {
        public ChangeAddressValidator(PrivacySettings privacySettings)
        {
            RuleFor(x => x.ChangeAddressLastName).NotEmpty();

            RuleFor(x => x.ChangeAddressAddress1).NotEmpty();
            RuleFor(x => x.ChangeAddressCity).NotEmpty();
            RuleFor(x => x.ChangeAddressZipPostalCode).NotEmpty();
            RuleFor(x => x.ChangeAddressCountry).NotEmpty();

            RuleFor(x => x.ChangeAddressEmail).NotEmpty();
            RuleFor(x => x.ChangeAddressEmail).EmailAddress();
            RuleFor(x => x.ChangeAddressPhoneNumber).NotEmpty();
        }
    }
}