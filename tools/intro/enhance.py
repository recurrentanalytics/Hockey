import cv2, numpy as np
def enhance(img, k, h=3):
    d = cv2.fastNlMeansDenoisingColored(img, None, h, h, 5, 15) if h else img
    up = cv2.resize(d, None, fx=k, fy=k, interpolation=cv2.INTER_LANCZOS4)
    sm = cv2.bilateralFilter(up, 2*k+1, 18, k)          # softens interpolation stair-steps, keeps edges
    bl = cv2.GaussianBlur(sm, (0,0), 0.6*k)
    return cv2.addWeighted(sm, 1.5, bl, -0.5, 0)
if __name__ == '__main__':
    src = cv2.imread('../geo/dop.jpg')
    cv2.imwrite('core.jpg', enhance(src, 2), [cv2.IMWRITE_JPEG_QUALITY, 86])
    x0,y0,x1,y1 = 780,520,1080,820
    det = enhance(src[y0:y1, x0:x1], 4)
    cv2.imwrite('detail.jpg', det, [cv2.IMWRITE_JPEG_QUALITY, 90])
    cv2.imwrite('outer_e.jpg', enhance(cv2.imread('outer.jpg'), 1, 2), [cv2.IMWRITE_JPEG_QUALITY, 85])
    a = cv2.resize(src[560:760, 800:1000], None, fx=4, fy=4, interpolation=cv2.INTER_NEAREST)
    b = det[(560-y0)*4:(760-y0)*4, (800-x0)*4:(1000-x0)*4]
    cv2.imwrite('compare.jpg', cv2.resize(np.hstack([a, b]), None, fx=0.6, fy=0.6, interpolation=cv2.INTER_AREA))
