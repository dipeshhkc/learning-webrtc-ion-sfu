import { useEffect } from "react";


export interface IModal {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  width?: string;
  zIndex?: string;
  onClose: () => void;
}


export const Modal: React.FC<IModal> = ({
  title,
  subtitle,
  onClose,
  isOpen,
  children,
  width = "lg",
  zIndex = "z-20",
}) => {
  useEffect(() => {
    document.body.style.overflowY = isOpen ? "hidden" : "auto";
  }, [isOpen]);

  return isOpen ? (
    <div className={`fixed inset-0 ${zIndex}`}>
      <div className="flex items-end justify-center  pt-4 px-4  pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" />
        </div>

        <div
          className={`inline-block  align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-center overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle ${
            width == "2xl" && "sm:max-w-2xl"
          }
            ${width == "lg" && "sm:max-w-lg"} 
            ${width == "6xl" && "sm:max-w-6xl"}
            ${width == "7xl" && "sm:max-w-7xl"}
            sm:w-full sm:p-6`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-headline"
        >
          <div className="hidden sm:block absolute top-0 right-0 pt-6 pr-4">
            <button
              type="button"
              onClick={onClose}
              className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <span className="sr-only">Close</span>
              <svg
                className="h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:mt-0 sm:text-left">
              <h3
                className="text-lg leading-6 font-medium text-gray-900"
                id="modal-headline"
              >
                {title}
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">{subtitle}</p>
              </div>
            </div>
          </div>
          <div className="overflow-auto max-h-modalScreen">{children}</div>
        </div>
      </div>
    </div>
  ) : (
    <></>
  );
};
